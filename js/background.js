//TODO: need to count number of new records during sync


(function(){

  

	Lazarus.environment = "background";
	
	Lazarus.Background = {
  
    initalized: false,
  
    updateURL: 'http://lazarus.interclue.com/updates/update-check.php?platform={platform}&version={version}&format=json',
	
    //time (in milliseconds) the user has to stop typing for 
    //before we send an autosave request to the background page
    AUTOSAVE_DELAY: 5, 
  
    autosaves: {},
    staleAutosaves: {},
    lastAutosave: '',
    lastAutosaveTime: 0,
    
    disabledDomains: {},
    
    canRemoveExpiredForms: true,
  
		init: function(){
      Lazarus.Background.runUpdates(function(){
        Lazarus.Background.initDatabase(function(){
          Lazarus.Background.initHashSeed(function(){
            Lazarus.Background.initEncryption(function(){
              Lazarus.Background.loadAutosaves();
              Lazarus.Sync.init();
              
              Lazarus.Background.initalized = true;
              
              setTimeout(Lazarus.Background.checkForUpdates, 6 * 1000);
              setTimeout(Lazarus.Background.checkExpiredForms, 10 * 1000);
            });
          });
        });
      });
		},
    
    
    checkExpiredForms: function(){
      Lazarus.Background.removeExpiredForms(function(){
        //check again in a while
        setTimeout(Lazarus.Background.checkExpiredForms, 30 * 60 * 1000);
      });
    },
    
    removeExpiredForms: function(callback){
      callback = (typeof callback == "function") ? callback : function(){};
      
      //remove all old forms from the database.
      //NOTE: if the user is currently looking at a list of items to recover, then we shouldn't remove any forms even if they have expired
      if (Lazarus.Background.canRemoveExpiredForms){
        Lazarus.logger.log("Remove Expired Forms...");
        Lazarus.getPref("expireFormsInterval", function(expireFormsInterval){
          Lazarus.getPref("expireFormsUnit", function(expireFormsUnit){
            var expiryTime = Lazarus.Utils.timestamp() - (expireFormsInterval * expireFormsUnit); 
            var now = Lazarus.Utils.timestamp();
            var query = "UPDATE {table} SET status = 1, lastModified = "+ now +" WHERE lastModified < "+ expiryTime;
            Lazarus.db.transaction(query, [{table:'forms'}, {table:'form_fields'}, {table:'fields'}], function(){
              Lazarus.logger.log("Expired Forms marked for removal");
              //remove any fully expired records
              Lazarus.Sync.isSyncEnabled(function(syncEnabled){
                if (!syncEnabled){
                  Lazarus.db.transaction("DELETE FROM {table} WHERE status = 1", [{table:'forms'}, {table:'form_fields'}, {table:'fields'}], function(){
                    callback();
                  });
                }
                else {
                  //wait for the onsync handler to remove the deleted records
                  callback();
                }
              });
            });
          });
        });
      }
      else {
        setTimeout(function(){
          Lazarus.logger.log("waiting to remove expired forms");
          Lazarus.Background.removeExpiredForms(callback);
        }, 5 * 1000);
      }
    },
    
    
    loadAutosaves: function(){
      Lazarus.logger.log("loading autosaved forms...");
      Lazarus.getPref("autosaves", function(encData){
        if (encData){
          Lazarus.getPref("encryptionMethod", function(encryptionMethod){
            //attempt to decrypt the data
            var data = Lazarus.AES.decrypt(encData, Lazarus.Background.hashSeed);
            
            if (data){
              try {
                var autosaves = JSON.parse(data);
                Lazarus.Background.staleAutosaves = autosaves;
                Lazarus.logger.log("Autosaved forms loaded.", Lazarus.Background.staleAutosaves);
              }
              catch(e){
                Lazarus.logger.error("Unable to parse autosaved forms, discarding", encData);
              }
            }
            else {
              Lazarus.logger.error("Unable to decrypt autosaved forms, discarding", encData);
            }
          })
          //either way, remove the old autosaves
          Lazarus.setPref("autosaves", null);
        }
        else {
          Lazarus.logger.log("No autosaves to load");
        }
      });
    },
    
    
    //autosaves are different from saving submitted forms.
    //submitted forms are kept for a long time, but autosaves should 
    //only be kept until after the next restart.
    //autosaves also happen a lot more often than submitted forms, 
    //so we won't be using anyhing that might block the UI when saving them 
    //(ie not database access, no encryption). I think the no encryption for autosaved forms
    //thing *might* be ok considering the forms will only be kept until the next restart of the browser
    //However if you're like me and leave the browser running 24/7 what then?
    //perhaps a time limit is a better plan? Yes, autosaves are for "emergency" recovery, 
    //I think having a default expiry time of 15 minutes should be plenty for most people.
    //after that the user shouldn't care if the unfinished form is lost.
    //but what about if they've walked away from the machine, it's gone into sleep, and the form is lost (eg machine has hung)?
    //Hmmm, needs pondering...
    autosaveForm: function(formInfo, callback){
      //we need to save the form as simply as possible, but we'll also need to be able to recover it using the form recovery code
      
      formInfo.lastModified = Lazarus.Utils.timestamp();
      
      //save to memory store
      Lazarus.Background.autosaves[formInfo.formInstanceId] = formInfo; 
      
      if (Lazarus.Background.lastAutosaveTime + Lazarus.Background.AUTOSAVE_DELAY < Lazarus.Utils.microtime()){
        //we're safe to save
        Lazarus.Background.saveAutosaves(function(){
          callback(true);
        });
      }
      //save after the autosave delay
      else if (!Lazarus.Background.autosaveTimer){
        Lazarus.Background.autosaveTimer = setTimeout(Lazarus.Background.saveAutosaves, Lazarus.Background.AUTOSAVE_DELAY);
        callback(false);
      }
      //the autosave timer has already been set,
      //form will be saved when it fires
      else {
        //do nothing
        callback(false);
      }
    },
    
    saveAutosaves: function(callback, force){
      callback = (typeof callback == "function") ? callback : function(){};
      
      //clear the autosave timer (if it exists)
      clearTimeout(Lazarus.Background.autosaveTimer);
      Lazarus.Background.autosaveTimer = 0;
      
      //we're going to encrypt the autosaves with the users hash seed.
      //this is obviously insecure (the hash seed is in plain text inside the database)
      //but the autosaves are only kept for the one session,
      //this also means that if the user resets the database then the autosaved text becomes very difficult to recover
      //also if the user has chosen to not encrypt their data (CPU issue?) then we'll leave it in plain json
      var json = JSON.stringify(Lazarus.Background.autosaves);
      if (json != Lazarus.Background.lastAutosave || force === true){
        Lazarus.logger.log("Autosaving forms", Lazarus.Background.autosaves);
        Lazarus.Background.lastAutosave = json;
        var data = Lazarus.AES.encrypt(json, Lazarus.Background.hashSeed);
        Lazarus.setPref("autosaves", data, function(){
          Lazarus.Background.lastAutosaveTime = Lazarus.Utils.microtime();
          callback(true);
        });
      }
      else {
        callback(true);
      }
    },
    
    //remove all forms from autosaves (and stale autosaves) that match the given function
    removeAutosaves: function(matchFn, callback){
      callback = callback || function(){}
      for(var formInstanceId in Lazarus.Background.autosaves){
        var form = Lazarus.Background.autosaves[formInstanceId];
        if (matchFn(form)){
          delete Lazarus.Background.autosaves[formInstanceId]
        }
      }
      for(var formInstanceId in Lazarus.Background.staleAutosaves){
        var form = Lazarus.Background.staleAutosaves[formInstanceId];
        if (matchFn(form)){
          delete Lazarus.Background.staleAutosaves[formInstanceId]
        }
      }
      Lazarus.Background.saveAutosaves(function(){
        callback();
      })
    },
    
    removeAllAutosaves: function(callback){
      Lazarus.Background.autosaves = {};
      Lazarus.Background.staleAutosaves = {};
      Lazarus.setPref("autosaves", '', function(){
        Lazarus.Background.lastAutosaveTime = 0;
        callback(true);
      });
    },
    
		
		saveForm: function(formInfo, callback){
			//time to save the form
			callback = callback || function(){};
			
			Lazarus.logger.log("saving form...");
			
			Lazarus.getPref("encryptionMethod", function(encryptionMethod){
				Lazarus.getPref("savePasswords", function(savePasswords){
				
					formInfo.encyptedURL = Lazarus.Background.encrypt(formInfo.url, encryptionMethod);
          formInfo.lastModified = Lazarus.Utils.timestamp();
          
          //generate an id for this form
          formInfo.domainId = Lazarus.Background.hash(formInfo.domain);
          formInfo.formId = Lazarus.Background.generateFormId(formInfo);
          
          //if the form already exists, then just update the timestamp
          //Lazarus.db.exe("UPDATE forms SET lastModified = {lastModified} WHERE id = {formId}", formInfo, function(){
            //
          //});
					
					Lazarus.db.exe("REPLACE INTO forms (id, domainId, url, lastModified) VALUES ({formId}, {domainId}, {encyptedURL}, {lastModified})", formInfo, function(){
						
						//build the list of fields we're going to save
						var fields = [];
						for(var i=0; i<formInfo.fields.length; i++){
							var field = formInfo.fields[i];
							
							if (!savePasswords && field.type === "password"){
								field.value = null;
							}
							
							//don't save fields if their value has been set to null (eg password fields)
							if (field.value !== null){
								field.id = Lazarus.Background.generateFieldId(field);
								field.formId = formInfo.formId;
								field.formFieldId = Lazarus.Background.hash(field.id +"-"+ field.formId);
								field.domainId = formInfo.domainId;
								field.encyptedValue = Lazarus.Background.encrypt(field.value, encryptionMethod);
                field.lastModified = formInfo.lastModified;
								fields.push(field);
							}
						}
						
						//insert the values for the fields 
						if (fields.length){
							var query = "REPLACE INTO fields (id, domainId, name, type, value, lastModified) VALUES ({id}, {domainId}, {name}, {type}, {encyptedValue}, {lastModified})";
							Lazarus.db.transaction(query, fields, function(){
							
								//now save the relationship between the fields and the form
								var query = "REPLACE INTO form_fields (id, formId, fieldId, lastModified) VALUES ({formFieldId}, {formId}, {id}, {lastModified})";
								Lazarus.db.transaction(query, fields, function(){
									Lazarus.logger.log("fields saved", arguments);
									callback(true);
								})
							});
						}
						else {
							Lazarus.logger.log("nothing to save");
							callback(false);
						}
					});
				});
			});			
		},
		
    
		hash: function(str, seed, returnAsHex){
			return Lazarus.FNV1a(str, seed, !returnAsHex);
		},
		
		/**
		* generate a hash for this field
		**/
		generateFieldId: function(field){
			return Lazarus.Background.hash(field.domain +","+ field.name +","+ field.type +","+ JSON.stringify(field.value));
		},
    
    /**
		* generate a hash for this form
		**/
		generateFormId: function(formInfo){
      //form id is unique for a form on a given URL with the same fields with the same values
      var str = formInfo.url;
      for(var i=0; i<formInfo.fields.length; i++){
        var field = formInfo.fields[i];
        str += ","+ field.name +","+ field.type +","+ JSON.stringify(field.value);
      }
      return Lazarus.Background.hash(str);
		},
		
		generateRandomHashSeed: function(){
      var rnd = Math.random().toString() +':'+ Lazarus.Utils.timestamp(true).toString();
      return Lazarus.FNV1a(rnd);
		},
		
		
		fetchSavedText: function(domain, callback){
			var args = {
				domainId: Lazarus.Background.hash(domain)
			}
			
			Lazarus.db.exe("SELECT value, forms.lastModified FROM fields INNER JOIN form_fields ON fields.id = form_fields.fieldId INNER JOIN forms ON forms.id = form_fields.formId WHERE type IN ('textarea', 'contenteditable') AND fields.domainId = {domainId} AND value != '' AND forms.status = 0 ORDER BY forms.lastModified DESC LIMIT 10", args, function(rs){
				
        //we'll use a map here instead of an array so we can avoid duplicate values
        var found = {};
        
        for(var i=0; i<rs.length; i++){
					rs[i].text = Lazarus.Background.decrypt(rs[i].value); 
          //ignore empty text, and only show distinct values
          if (rs[i].text){
            found[rs[i].text] = rs[i];
          }
					else {
						Lazarus.logger.warn("Unable to decrypt text", rs[i].value);
					}
				}
        
        //add any text from the autosaved data
        Lazarus.Background.fetchAutosavedText(domain, function(autosaves){
          for(var i=0; i<autosaves.length; i++){
            if (autosaves[i].text){
              found[autosaves[i].text] = autosaves[i];
            }
          }
          
          //convert the map into an array
          found = Lazarus.Utils.mapToArray(found);
          
          found.sort(Lazarus.Background.orderByLastModified);
          
          callback(found);
        });
			});
		},
    
    
    
    fetchAutosavedText: function(domain, callback){
      //stale autosaves are fetched at browser startup?
      //grab the autosaves for this session, and the previous session that match the fieldInfo provided.
      var found = [];
      
      //console.log("adding autosaved forms");
      for(var id in Lazarus.Background.autosaves){
        var formInfo = Lazarus.Background.autosaves[id];
        if (formInfo.domain == domain){
          for(var i=0; i<formInfo.fields.length; i++){
            var field = formInfo.fields[i];
            if (Lazarus.Utils.isLargeTextFieldType(field.type) && field.value != ''){
              found.push({
                text: field.value,
                lastModified: formInfo.lastModified
              });
            }
          }
        }
      }
      //console.log("adding autosaved forms");
      for(var id in Lazarus.Background.staleAutosaves){
        var formInfo = Lazarus.Background.staleAutosaves[id];
        if (formInfo.domain == domain){
          for(var i=0; i<formInfo.fields.length; i++){
            var field = formInfo.fields[i];
            if (Lazarus.Utils.isLargeTextFieldType(field.type) && field.value != ''){
              found.push({
                text: field.value,
                lastModified: formInfo.lastModified
              });
            }
          }
        }
      }
      
      //console.log("autosaved texts found", found);
      callback(found);
    },
    
    
    orderByLastModified: function(a, b){
      return (a.lastModified > b.lastModified) ? -1 : 1;
    },
		
		
		fetchSavedFields: function(fieldInfo, callback){
			fieldInfo.domainId = Lazarus.Background.hash(fieldInfo.domain);
			Lazarus.db.exe("SELECT value, formId, forms.lastModified FROM fields INNER JOIN form_fields ON fields.id = form_fields.fieldId INNER JOIN forms ON forms.id = form_fields.formId WHERE name = {name} AND type = {type} AND fields.domainId = {domainId}  AND value != '' AND forms.status = 0 ORDER BY forms.lastModified DESC LIMIT 10", fieldInfo, function(rs){
        //we'll keep a map instead of an array to avoid duplicate forms
        var found = {};
				
        //we'll need to decrypt the values
				for(var i=0; i<rs.length; i++){
					rs[i].text = Lazarus.Background.decrypt(rs[i].value);
					if (rs[i].text){
						found[rs[i].formId] = rs[i];
					}
					else {
						Lazarus.logger.warn("Unable to decrypt text", rs[i].value);
					}
				}
        
        //add any fields/forms from the autosaved data
        Lazarus.Background.fetchAutosavedFields(fieldInfo, function(autosaves){
          for(var i=0; i<autosaves.length; i++){
            found[autosaves[i].formId] = autosaves[i];
          }
          
          //convert to an array
          found = Lazarus.Utils.mapToArray(found);

          //and sort nicely
          found.sort(Lazarus.Background.orderByLastModified);
          
          callback(found);
        });
			});
		},
    
    
    fetchAutosavedFields: function(fieldInfo, callback){
      //stale autosaves are fetched at browser startup?
      //grab the autosaves for this session, and the previous session that match the fieldInfo provided.
      var found = [];
      
      //console.log("adding autosaved forms");
      for(var id in Lazarus.Background.autosaves){
        var formInfo = Lazarus.Background.autosaves[id];
        var field = Lazarus.Background.findValidField(formInfo, fieldInfo);
        if (field){
          //console.log("found", formInfo);
          field.formInfo = formInfo;
          field.formId = Lazarus.Background.generateFormId(formInfo);
          field.lastModified = formInfo.lastModified;
          
          //mark this as an autosaved form
          found.push(field);
        }
      }
      
      //console.log("adding stale autosaved forms");
      for(var id in Lazarus.Background.staleAutosaves){
        var formInfo = Lazarus.Background.staleAutosaves[id];
        var field = Lazarus.Background.findValidField(formInfo, fieldInfo);
        if (field){
          //console.log("found", formInfo);
          field.formInfo = formInfo;
          field.formId = Lazarus.Background.generateFormId(formInfo);
          field.lastModified = formInfo.lastModified;
          
          //mark this as an autosaved form
          field.isAutosave = true;
          found.push(field);
        }
      }
      
      //console.log("autosaved fields found", found);
      callback(found);
    },
    
    
    findValidField: function(formInfo, fieldInfo){
      //form is valid if it's from the same domain, and it contains a field with the same name and type as the field info
      //SQL: WHERE name = {name} AND type = {type} AND domainId = {domainId}  AND value != ''
      //console.log("isValidForm", formInfo, fieldInfo);
      
      if (formInfo.domain == fieldInfo.domain){
        //find the field with this name
        for(var i=0; i<formInfo.fields.length; i++){
          var field = formInfo.fields[i];
          //console.log(formInfo, fieldInfo, field.name, field.name == fieldInfo.name , field.type == fieldInfo.type , field.value != '')
          if (field.name == fieldInfo.name && field.type == fieldInfo.type && field.value != ''){
            return {
              text: field.value,
              formId: 'autosave:'+ formInfo.formInstanceId
            }
          }
        }
      }
      return false;
    },
    
		
		fetchForm: function(formId, callback){
    
      if (typeof formId == "string" && formId.indexOf('autosave:') === 0){
        formId = formId.replace('autosave:', '');
        //look for the autosave
        var formInfo = Lazarus.Background.autosaves[formId] || Lazarus.Background.staleAutosaves[formId] || null;
        callback(formInfo);
      }
      else {
        //fetch the info about the form
        Lazarus.db.getObj("SELECT id, url FROM forms WHERE id = {formId}", {formId:formId}, function(info){
          //and attach all the fields for this formId
          if (info){
            info.url = Lazarus.Background.decrypt(info.url);
            Lazarus.db.exe("SELECT fields.id, name, type, value, domainId FROM fields INNER JOIN form_fields ON fields.id = fieldId WHERE formId = {formId}", {formId:formId}, function(rs){
              info.fields = rs;
              for(var i=0; i<info.fields.length; i++){
                info.fields[i].value = Lazarus.Background.decrypt(info.fields[i].value);
              }
              callback(info);
            });	
          }
          else {
            //no form found
            callback(null);
          }
        });
      }
		},
		
		setSetting: function(name, value, callback){
      var data = {
        name: name, 
        value: JSON.stringify(value),
        lastModified: Lazarus.Utils.timestamp()
      }
			Lazarus.db.exe("REPLACE INTO settings (name, value, lastModified) VALUES ({name}, {value}, {lastModified})", data, function(result){
				if (callback){
					callback(result);
				}
			});
		},
		
		
		getSetting: function(name, callback, defaultVal){
			defaultVal = (typeof defaultVal == "undefined") ? null : defaultVal;
			Lazarus.db.getStr("SELECT value FROM settings WHERE name = {name}", {name:name}, function(json){
				var value = (json) ? JSON.parse(json) : defaultVal;
        if (value === null){
          value = defaultVal
        }
				callback(value);
			});
		},
		
    getSettings: function(names, callback){
      for(var i=0; i<names; i++){
        names[i] = [names[i]];
      }
      Lazarus.Utils.callAsyncs(Lazarus.Background.getSetting, names, function(results){
        var settings = {};
        for(var i=0; i<results.length; i++){
          settings[name[i]] = results[i];
        }
        callback(settings);
      })
		},
    
		initDatabase: function(callback){
			Lazarus.logger.log("initalizing database...");
			Lazarus.Utils.callAsyncs(Lazarus.db.exe, [
				["CREATE TABLE IF NOT EXISTS forms (id INTEGER PRIMARY KEY, domainId INTEGER, url TEXT, lastModified INTEGER, status INTEGER DEFAULT 0)"],
				["CREATE TABLE IF NOT EXISTS fields (id INTEGER PRIMARY KEY, domainId INTEGER, name TEXT, type TEXT, value TEXT, lastModified INTEGER, status INTEGER DEFAULT 0)"],
				["CREATE TABLE IF NOT EXISTS form_fields (id INTEGER PRIMARY KEY, formId INTEGER, fieldId INTEGER, lastModified INTEGER, status INTEGER DEFAULT 0)"],
				["CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT, lastModified INTEGER, status INTEGER DEFAULT 0)"]
			], function(){
      
        //if a settings_original table exists, then something has gone wromng whilst setting up sync,
        //we should restore the original settings
        Lazarus.db.tableExists("settings_original", function(exists){
          if (exists){
            Lazarus.Sync.restoreSettings(function(){
              Lazarus.logger.log("database initalized");
              if (callback){
                callback();
              }
            });
          }
          else {
            Lazarus.logger.log("database initalized");
            if (callback){
              callback();
            }
          }
        });
			});
		},
		
		
		initHashSeed: function(callback){
			callback = callback || function(){};
			Lazarus.logger.log("initalizing hash seed");
			//we need a random hash seed for this user
			Lazarus.Background.getSetting("hashSeed", function(hashSeed){
				if (!hashSeed){
					Lazarus.Background.hashSeed = Lazarus.Background.generateRandomHashSeed();
					Lazarus.logger.log("saving new hash seed "+ hashSeed);
					Lazarus.Background.setSetting("hashSeed", Lazarus.Background.hashSeed, callback);
				}
				else {
					Lazarus.Background.hashSeed = hashSeed;
					callback();
				}
			});
		},
		
		
		initEncryption: function(callback){
			//generate an RSA public/private key pair in case the user wants more serious security
			callback = callback || function(){};
			Lazarus.logger.log("initalizing rsa key pair");
      
			Lazarus.Background.getSetting("publicKey", function(packedPublicKey){
        var publicKey = Lazarus.Crypto.unpack(packedPublicKey);
				
				Lazarus.Background.getSetting("privateKey", function(encryptedPackedPrivateKey){
					//by default the privateKey is encrypted with a blank password
					//when a user wants to enable encryption we'll AES encrypt the privateKey using the users passphrase
					var packedPrivateKey = Lazarus.AES.decrypt(encryptedPackedPrivateKey, "");
					var privateKey = packedPrivateKey ? Lazarus.Crypto.unpack(packedPrivateKey) : null;
					
					if (!publicKey){
						Lazarus.logger.log("generating new key pair...");
						var newKeys = Lazarus.Crypto.generateKeyPair();
						Lazarus.logger.log("saving new key pair ", newKeys);
						Lazarus.Background.publicKey = newKeys.publicKey;
						Lazarus.Background.privateKey = newKeys.privateKey;
            
						var newEncryptedPackedPrivateKey = Lazarus.AES.encrypt(Lazarus.Crypto.pack(newKeys.privateKey), "");
						
						Lazarus.Background.setSetting("publicKey", Lazarus.Crypto.pack(newKeys.publicKey), function(){
							Lazarus.Background.setSetting("privateKey", newEncryptedPackedPrivateKey, function(){
								callback();
							});
						});
					}
					else {
						Lazarus.Background.publicKey = publicKey;
						Lazarus.Background.privateKey = privateKey;
						Lazarus.logger.log("publicKey", publicKey, "privateKey", privateKey);
						callback();
					}
				});
			});
		},
    
    
		
		rebuildDatabase: function(callback){
      //empty the database
      Lazarus.db.exe("SELECT name, type FROM sqlite_master WHERE type='table'", function(rs){
      
        var queries = [];
        
        for(var i=0; i<rs.length; i++){
          switch(rs[i].type){
            case 'table':
              //webkit adds it's own table (__WebKitDatabaseInfoTable__) to our list of tables, gee thanks webkit
              if (rs[i].name.substr(0, 2) != "__"){
                queries.push(["DROP TABLE '"+ rs[i].name +"'"]);
              }
            break;
            
            case 'index':
              //ignore the autoindexes created by sqlite 
              if (rs[i].name.indexOf("sqlite_autoindex_") !== 0){
                queries.push(["DROP INDEX '"+ rs[i].name +"'"]);
              }
            break;
            
            default:
              //ignore all other types for now
              //do any other types even exist?
            break
          }
        }
        
        //now remove all the tables and indexes
        Lazarus.Utils.callAsyncs(Lazarus.db.exe, queries, function(){
        
          //then rebuild the database
          Lazarus.Background.initDatabase(function(){
            Lazarus.Background.initHashSeed(function(){
              Lazarus.Background.initEncryption(function(){
                //remove all autosaved forms as well
                Lazarus.Background.removeAllAutosaves(function(){
                  callback();
                });
              });
            });
          }); 
        })
      });
		},
    
    rebuildEncryptionKeys: function(callback){
			//rebuilding the keys also means removing all saved forms, so...
			Lazarus.db.transaction("DROP TABLE {name}", [{name:"forms"}, {name:"fields"}, {name:"form_fields"}], function(rs){
        Lazarus.Background.setSetting("hashSeed", "", function(){
          Lazarus.Background.setSetting("privateKey", "", function(){
            Lazarus.Background.setSetting("publicKey", "", function(){
              //then rebuild the database
              Lazarus.Background.initDatabase(function(){
                Lazarus.Background.initHashSeed(function(){
                  Lazarus.Background.initEncryption(callback);
                });
              });
            });
          });
        });
			});
		},
		
		openOptions: function(){
			Lazarus.openURL(Lazarus.baseURI +"options.html");
		},
		
		/**
		* encrypt a string using the user chosen encryption method
		* return an object specifying the encryption method and encrypted value
		**/
		encrypt: function(obj, method){
      
      //special case Empty String 
      //we'll need to be able to identify empty strings inside the database (so we can ignore them when getting a list of field values to show)
      //so we're going to make an exception, and just save as they are instead of running them through the encryption process
      if (obj === ""){
        return "";
      }
			
			var json = JSON.stringify(obj);
			
			var encrypted = {
				method: method
			};
			
			switch(method){
				case "none":
					encrypted.value = json;
					return JSON.stringify(encrypted);
				
				case "hybrid":
					if (Lazarus.Background.publicKey){
						encrypted.value = Lazarus.Crypto.encrypt(json, Lazarus.Background.publicKey);
						return JSON.stringify(encrypted);
					}
					else {
						throw Error("encrypt: public key not loaded");
					}
				
				default:
					throw Error("encrypt: unknown encryption method '"+ method +"'");
			}
		},
		
		decrypt: function(json){
      //special case Empty string 
      //we'll need to be able to identify empty strings inside the database (so we can ignore them when getting a list of field values to show)
      //so we're going to make an exception, and just save as they are instead of running them through the encryption process
      if (json === ""){
        return "";
      }
			var encrypted = JSON.parse(json);
			if (encrypted.method && typeof encrypted.value !== "undefined"){
				switch(encrypted.method){
					case "none":
						return JSON.parse(encrypted.value);
					
					case "hybrid":
						if (Lazarus.Background.privateKey){
							return JSON.parse(Lazarus.Crypto.decrypt(encrypted.value, Lazarus.Background.privateKey));
						}
						else {
							throw Error("decrypt: private key not loaded");
						}
					
					default:
						throw Error("decrypt: unknown encryption method '"+ encrypted.method +"'");
				}
			}
			else {
				throw Error("decrypt: invalid object, expected obj.method and obj.value '"+ json +"'");
			}
		},
    
    
    //return true if the user requires a password before they can restore text (ie: encryption is enabled, and password has not been entered yet)
    isPasswordRequired: function(callback){
      //private key may or may not be encrypted, but either way the user can decrypt a string
      if (Lazarus.Background.privateKey){
        callback(false);
      }
      //try to load the private key
      else {
        //XXX FIXME: can't we just detect the privateKey? callback(!Lazarus.Background.privateKey)?
        Lazarus.Background.initEncryption(function(){
          //if after re-initalizing the keys we still don't have a privateKey,
          //then the private key must be encrypted
          Lazarus.Background.privateKey ? callback(false) : callback(true);
        })
      }
    },
		
    
    isPasswordSet: function(callback){
    
      //we test this by attempting to decrypt the private key string with a blank password
      Lazarus.Background.getSetting('privateKey', function(packedEncryptedPrivateKey){
        if (packedEncryptedPrivateKey){
          var packedPrivateKey = Lazarus.AES.decrypt(packedEncryptedPrivateKey, "");
          var privateKey = Lazarus.Crypto.unpack(packedPrivateKey);
          callback(privateKey ? false : true);
        }
        //no key set
        else {
          throw Error("isPasswordSet: No private-key found in database!");
        }    
      });
    },
    
    //return true if a user has set a password, and they have logged in
    isLoggedIn: function(callback){
      Lazarus.Background.isPasswordSet(function(passwordSet){
        if (passwordSet){
          Lazarus.Background.isPasswordRequired(function(passwordRequired){
            passwordRequired ? callback(false) : callback(true);
          })
        }
        else {
          callback(false);
        }
      })
    },
    
    attemptLogin: function(password, callback){
      Lazarus.logger.log("attempting login")
      Lazarus.Background.fetchPrivateKey(password, function(privateKey){
        if (privateKey){
          Lazarus.logger.log("logged in", privateKey);
          //log em in
          Lazarus.Background.privateKey = privateKey;
          callback(true);
        }
        else {
          Lazarus.logger.log("login failed");
          callback(false);
        }
      });
    },
    
    logout: function(callback){
      callback = callback || function(){}
      //just remove the privateKey?
      Lazarus.Background.privateKey = null;
      callback(true);
    },
    
    fetchPrivateKey: function(password, callback){
    
      Lazarus.Background.getSetting('privateKey', function(packedEncryptedPrivateKey){
        password = password || '';
        if (packedEncryptedPrivateKey){
          try {
            var packedPrivateKey = Lazarus.AES.decrypt(packedEncryptedPrivateKey, password);
            var privateKey = Lazarus.Crypto.unpack(packedPrivateKey);
            if (privateKey){
              callback(privateKey);
            }
            else {
              callback(null);
            }
          }
          catch(e){
            //failed to decrypt therefore password is incorrect (or key is corrupt?)
            Lazarus.logger.log("Private-key password protected or corrupt");
            callback(null);
          }
        }
        else {
          throw Error("fetchPrivateKey: No private-key found in database!");
        }
      });
    },
    
    
    savePrivateKey: function(privateKey, password, callback){
      Lazarus.logger.log('saving private key...', privateKey);
      
      password = password || "";
      callback = callback || function(){}
      
      //convert the key to a string
      var packedPrivateKey = Lazarus.Crypto.pack(privateKey);
      //encrypt the packed key
      var encryptedPackedPrivateKey = Lazarus.AES.encrypt(packedPrivateKey, password);
			//and save 
      Lazarus.Background.setSetting("privateKey", encryptedPackedPrivateKey, function(){
        Lazarus.logger.log('private key saved.', encryptedPackedPrivateKey);
        callback();
      });
    },
    
    disableByDomain: function(domain, callback){
      callback = callback || function(){}
      
      Lazarus.Background.getSetting("disabledDomains", function(disabledDomains){
        disabledDomains[domain] = true;
        Lazarus.Background.setSetting("disabledDomains", disabledDomains, function(){
          //remove from autosaves
          Lazarus.Background.removeAutosaves(function(formInfo){
            return (formInfo.domain == domain);
          }, function(){
            //and from the database
            var domainId = Lazarus.Background.hash(domain);
            var now = Lazarus.Utils.timestamp();
            Lazarus.db.exe("UPDATE fields SET status = 1, lastModified = "+ now +" WHERE domainId = {domainId}", {domainId:domainId}, function(rs){
              Lazarus.db.getColumn("SELECT id FROM forms WHERE domainId = {domainId}", {domainId:domainId}, function(formIds){
                if (formIds.length > 0){
                  Lazarus.db.exe("UPDATE form_fields SET status = 1, lastModified = "+ now +" WHERE formId IN ("+ formIds.join(",") +")", function(rs){
                    Lazarus.db.exe("UPDATE forms SET status = 1, lastModified = "+ now +" WHERE id IN ("+ formIds.join(",") +")", function(rs){
                      callback(true);
                    });
                  });
                }
                else {
                  //nothing to delete
                  callback(true);
                }
              });
            });
          });
        });
      }, {});
    },
    
    
    
    
    
    
    saveDisabledDomains: function(callback){
      Lazarus.Background.setSetting("disabledDomains", Lazarus.Background.disabledDomains, function(){
        callback();
      });
    },
    
    isDomainEnabled: function(domain, callback){
      Lazarus.Background.getSetting("disabledDomains", function(disabledDomains){
        if (disabledDomains && disabledDomains[domain]){
          callback(false);
        }
        else {
          callback(true);
        }
      })
    },
    
    
    runUpdates: function(callback){
      //XXX TODO: show dialog asking if the user wants to reset the database if an error occurs?
      Lazarus.getPref("build", function(prevBuild){
        if (prevBuild && Lazarus.build > prevBuild){
          Lazarus.logger.log("updating from "+ prevBuild +" to "+ Lazarus.build);
          //args is an array of arrays where each internal array is the arguments to pass to the function to be called
          var args = [];
          for(var i=prevBuild+1; i<=Lazarus.build; i++){
            if (Lazarus.Updates[i]){
              args.push([i]);
            }
          }
          
          if (args.length > 0){
            var runUpdate = function(id, callback){
              Lazarus.logger.warn("Running update "+ id +"...");
              Lazarus.Updates[id](callback);
            }
            
            Lazarus.Utils.callAsyncs(runUpdate, args, function(results){
              //no errors means a successful update, increment the build number
              Lazarus.setPref("build", Lazarus.build, function(){
                Lazarus.logger.log("Update successful");
                callback();
              })
            })
          }
          //no updates to run
          Lazarus.setPref("build", Lazarus.build, function(){
            callback();
          })
        }
        else {
          //no updates to run
          Lazarus.setPref("build", Lazarus.build, function(){
            callback();
          })
        }
      })
    },
    
    
    ajax: function(url, data, callback, options){
			//TODO: make errors return an error message
      callback = callback || function(){}
      var defaults = {
        method: (data ? 'POST' : 'GET'),
        responseType: 'json',
        noCache: false
      }
      var opts = Lazarus.Utils.extend(defaults, options);
      
      //prepare the url
      var requestData = '';
      if (data){
        var pairs = [];
        for(var key in data){
          pairs.push(encodeURIComponent(key) +'='+ encodeURIComponent(data[key]));
        }
        requestData = pairs.join("&");
      }
      if (data && opts.method == "GET"){
        url += (url.indexOf("?") > -1) ? "&" : "?";
        url += requestData;
        requestData = null;
      }
      if (opts.noCache){
        url += (url.indexOf("?") > -1) ? "&" : "?";
        url += "_="+ Lazarus.Utils.microtime();
      }
      
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method, url);
      if (opts.method == "POST"){
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      }
      xhr.onreadystatechange = function(){
        if (xhr.readyState == 4){
          Lazarus.logger.log("Ajax: response", xhr.status, xhr.responseText);
          if (xhr.status == 304 || (xhr.status >= 200 && xhr.status <= 299)){
            var response = null;
            try {
              response = JSON.parse(xhr.responseText);
            }catch(e){}
            
            if (response){
              callback(response);
            }
            else {
              Lazarus.logger.error("Ajax: invalid response: "+ xhr.responseText);
              callback({error: 'Non-JSON response', text: xhr.responseText});
            }
          }
          else {
            Lazarus.logger.warn("Ajax: server error: "+ xhr.status);
            callback({error: 'Http Error: '+ (xhr.status || 'Server unavailable')});
          }
        }
      }
      Lazarus.logger.log("Ajax: request", url, data);
      xhr.send(requestData);
    },
    
    
    checkForUpdates: function(force, callback){
    
      callback = callback || function(){};
    
			//one day in seconds
      var ONE_DAY = 24 * 60 * 60;
      
      //I like to keep my browser open for days at a time,
      //so we should see if we need to check once per hour
      setTimeout(Lazarus.Background.checkForUpdates, 60 * 60 * 1000);
      
      Lazarus.getPref("checkForUpdates", function(checkForUpdates){
        Lazarus.getPref("lastUpdateCheck", function(lastUpdateCheck){
          Lazarus.getPref("guid", function(guid){
        
            if (!guid){
              guid = ("{"+ Math.random() +"-"+ Math.random() +"}").replace(/\./g, "");
              Lazarus.setPref("guid", guid);
            }
            if (force === true || (checkForUpdates && (lastUpdateCheck + ONE_DAY < Lazarus.Utils.timestamp()))){
              Lazarus.logger.log("checking for updates...");
              var url = Lazarus.Background.updateURL.replace("{platform}", Lazarus.platform).replace("{version}", Lazarus.version);
              //prevent the url from being cached 
              url += "&_="+ Lazarus.Utils.microtime();
              
              var xhr = new XMLHttpRequest();
              xhr.open("POST", url);
							xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
              
              //prepare the url
              var data = {
                guid: guid
              }
              
              var pairs = [];
              for(var key in data){
                pairs.push(encodeURIComponent(key) +'='+ encodeURIComponent(data[key]));
              }
              var postData = pairs.join("&");
              
              xhr.onreadystatechange = function(){
                if (xhr.readyState == 4){
                  if (xhr.status == 304 || (xhr.status >= 200 && xhr.status <= 299)){
                    var response = null;
                    try {
                      var response = JSON.parse(xhr.responseText);
                    }catch(e){}
                    
                    if (response && response.version){
                      Lazarus.Background.latestVersionInfo = response;
                      Lazarus.logger.log("update check response", response);
                      //TODO: notify the user that there's a new update available
                      Lazarus.setPref("lastUpdateCheck", Lazarus.Utils.timestamp(), function(){
                        if (Lazarus.Utils.versionCompare(response.version, ">", Lazarus.version)){
                          //new version available!
                          //what to do?
                          callback(response);
                        }
                        else {
                          callback(response);
                        }
                      })
                    }
                    else {
                      Lazarus.logger.error("Update check: invalid response: "+ xhr.responseText);
                      callback(null);
                    }
                  }
                  else {
                    Lazarus.logger.warn("Update check failed: status = "+ xhr.status);
                    callback(null);
                  }
                }
              }
              xhr.send(postData);
            }
          })
        })
      })
    }
	}
	
})();



