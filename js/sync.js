//TODO: test syncing more than 1000 records (or at least multiple requests to the server)

Lazarus.Sync = {

  ERROR_INCORRECT_SYNC_KEY: 10001,
  
  API_VERSION: 1,

  syncing: false,
  
  syncTimer: 0,
  
  syncTime: 0,
  
  //time (in milliseconds) before a sync will occur after running a database operation
  SYNC_DATABASE_DELAY: 3000, 
  
  //maximum time (in seconds) between syncs (assuming browser is not idle)
  SYNC_IDLE_TIME: 60 * 60,
  
  
  tables: {
    'forms': 'id',
    'form_fields': 'id', 
    'fields': 'id',
    'settings': 'name'
  },
  
  //list of records to ignore when syncing
  ignoreRecords: [
    {tableName: 'settings', primaryKeyField: 'lastSyncTime'}
  ],
  

  init: function(){
    
    //on every query we should do a sync after the query has completed,
    //but not right after, we should probably wait a little or we risk hammering our server,
    //Also note, that any queries that occur _while_ we are syncing should not
    //start another round of syncing (otherwise infinite loop)
    Lazarus.Event.addListener('databaseExecute', function(query){
      //ignore SELECT queries
      if (Lazarus.Sync.canSync() && !query.match(/^SELECT/i)){
        Lazarus.Sync.restartSyncTimer();
      }
    });
    
    Lazarus.Event.addListener('databaseTransaction', function(queries){
      for(var i=0; i<queries.length; i++){
        if (Lazarus.Sync.canSync() && !queries[i].match(/^SELECT/i)){
          Lazarus.Sync.restartSyncTimer();
          break;
        }
      }
    });
  },
  
  onClick: function(){
    //if the user hasn't synced in the last X minutes then force a sync now.
    Lazarus.Background.getSetting('lastSyncTime', function(lastSyncTime){
      if ((lastSyncTime + Lazarus.Sync.SYNC_IDLE_TIME < Lazarus.Utils.timestamp()) && Lazarus.Sync.canSync()){
        Lazarus.Sync.runSync();
      }
    }) 
  }, 
  
  isSyncEnabled: function(callback){
    Lazarus.getPref('syncEnabled', function(syncEnabled){
      callback(syncEnabled);
    });
  },
  
  canSync: function(){
    //time (in seconds) in which the syncing flag should be removed even if the sync operation hasn't finished 
    //after which it's safe to say something has gone wrong and prevented the flag from being reset.
    var LAST_SYNC_EXPIRY_TIME = 5 * 60; 
    var LAST_SYNC_MIN_WAIT_TIME = 15; 
    
    if (Lazarus.Sync.syncing){
      //if the last sync time was a long time ago and the Lazarus.Sync.syncing flag is still true,
      //then something has probably gone wrong, let's reset the flag and try again
      if (Lazarus.Sync.syncTime + LAST_SYNC_EXPIRY_TIME < Lazarus.Utils.timestamp()){
        Lazarus.logger.warn("Lazarus.Sync.syncing: broken sync? force resetting of sync flag");
        Lazarus.Sync.syncing = false;
        return true;
      }
      else {
        return false;
      }
    }
    else {
      return (Lazarus.Sync.syncTime + LAST_SYNC_MIN_WAIT_TIME < Lazarus.Utils.timestamp());
    }
  },
  
  restartSyncTimer: function(){
    clearTimeout(Lazarus.Sync.syncTimer);
    setTimeout(function(){
      Lazarus.Sync.runSync();
    }, Lazarus.Sync.SYNC_DATABASE_DELAY);
  },
  
  runSync: function(){
  
    //check again to make sure we can run this sync
    if (Lazarus.Sync.canSync()){
      Lazarus.getPrefs(['syncEnabled', 'syncKey', 'userId'], function(prefs){
        if (prefs.syncEnabled){
          if (prefs.syncKey && prefs.userId){
            Lazarus.Background.getSetting('lastSyncTime', function(lastSyncTime){
              if (lastSyncTime){
                //just run a normal sync
                Lazarus.Sync.syncDatabase();
              }
              else {
                //this database has never been synced, but we have sync credentials (userId, syncKey)
                //therefore the primary sync must have alread occured (unless the primary sync failed due to server problems)
                Lazarus.Sync.setupSecondarySync();
              }
            }, 0)
          }
          else {
            //WTF?
            Lazarus.logger.error('Sync enabled, but syncKey and/or userId is missing', prefs);
          }
        }
      });
    }
  },


  setupPrimarySync: function(callback){
    //setup the first browser sync. All records, hashSeeds, and keys from this browser should be sent to the server
    Lazarus.Sync.syncDatabase(callback);
  },
  
  
  backupSettings: function(callback){
    Lazarus.logger.log("backing up settings...");
    Lazarus.db.exe("ALTER TABLE settings RENAME TO settings_original", function(){
      Lazarus.db.exe("CREATE TABLE settings (name TEXT PRIMARY KEY, value TEXT, lastModified INTEGER, status INTEGER DEFAULT 0)", function(){
        callback();
      });
    });
  },
  
  
  restoreSettings: function(callback){
    Lazarus.logger.log("restoring settings...");
    Lazarus.db.exe("DROP TABLE settings", function(){
      Lazarus.db.exe("ALTER TABLE settings_original RENAME TO settings", function(){
        callback();
      });
    });
  },

  
  setupSecondarySync: function(callback){
    callback = callback || function(){};
    //secondary browsers shouldn't sync their keys, in fact their keys need to be overwritten by the primary browsers keys
    
    Lazarus.Sync.backupSettings(function(){
      Lazarus.Sync.syncDatabase(function(response){
        Lazarus.Sync.syncing = true;
        if (response.errorMessages){
          //something went wrong, restore the original settings
          Lazarus.Sync.restoreSettings(function(){
            Lazarus.Sync.syncing = false;
            callback(response);
          });
        }
        else {
          //all good, remove the original settings
          Lazarus.db.exe("DROP TABLE settings_original", function(){
            //re-load the encryption keys (they might have been changed)
            Lazarus.Background.initEncryption(function(){
              //and the hash seed
              Lazarus.Background.initHashSeed(function(){
                Lazarus.Background.saveAutosaves(function(){
                  Lazarus.Sync.syncing = false;
                  callback(response);
                }, true);
              });
            });
          });
        }
      });
    });
  },
  
  
  checkSyncKey: function(callback){
    Lazarus.getPref('syncKeyHash', function(syncKeyHash){
      Lazarus.Sync.callAPI("/sync/checkSyncKey", {syncKeyHash:syncKeyHash}, callback);
    });
  },


  //responds with {success:true} or {success:false, error: errorMessage}
  syncDatabase: function(callback){
    //get settings
    callback = callback || function(){};
    
    Lazarus.Sync.syncing = true;
    Lazarus.Sync.syncTime = Lazarus.Utils.timestamp();
    
    Lazarus.logger.log('syncing database...');
    
    Lazarus.getPrefs(['userId', 'syncKey'], function(prefs){
      Lazarus.Background.getSetting('lastSyncTime', function(lastSyncTime){
        var errorMessages = [];
        if (!prefs.userId){
          errorMessages.push("Missing preference 'userId'");
        }
        if (!prefs.syncKey){
          errorMessages.push("Missing preference 'syncKey'");
        }
      
        if (errorMessages.length == 0){
          Lazarus.logger.log('Sync: getRecordsToSync...');
          Lazarus.Sync.getRecordsToSync(lastSyncTime, prefs.syncKey, function(records){
            //we need to get the list of new records from the server before
            //sending our updated records to the server
            Lazarus.Sync.getUpdatedRecords(prefs.userId, lastSyncTime, function(response){  
              Lazarus.logger.log('Sync: getUpdatedRecords', response);
              if (response.errorMessages){
                Lazarus.Sync.syncing = false;
                callback(response);
              }
              else {
                var updatedRecords = response.updatedRecords;
                //send any new records to the server
                Lazarus.logger.log('Sync: sending '+ records.length +' records to the server...', records);
                Lazarus.Sync.sendToServer(prefs.userId, lastSyncTime, records, function(response){
                  Lazarus.logger.log('Sync: sendToServer response', response);
                  if (response.errorMessages){
                    Lazarus.Sync.syncing = false;
                    callback(response);
                  }
                  else {
                    //load any new records received from the server
                    Lazarus.logger.log('Sync: merging '+ updatedRecords.length +' records from server...');
                    Lazarus.Sync.mergeUpdatedRecords(updatedRecords, prefs.syncKey, function(){
                      Lazarus.logger.log('Sync: mergeUpdatedRecords complete');
                      //update is actually successfull, phew!
                      Lazarus.Background.setSetting('lastSyncTime', Lazarus.Sync.syncTime, function(){
                        Lazarus.Sync.removeDeletedRecords(function(){
                          Lazarus.Sync.syncTime = Lazarus.Utils.timestamp();
                          Lazarus.Event.fire("syncComplete");
                          Lazarus.Sync.syncing = false;
                          callback(true);
                        });
                      });
                    });
                  }
                });
              }
            });
          });
        }
        else {
          Lazarus.Sync.syncing = false;
          callback({errorMessages:errorMessages});
        }
      }, 0);
    });
  },
  
  //after a successful sync it is now possible to remove any records that have been marked for deletion
  removeDeletedRecords: function(callback){
    var query = "DELETE FROM {table} WHERE status = 1";
    Lazarus.db.transaction(query, [{table:'forms'}, {table:'form_fields'}, {table:'fields'}, {table:'settings'}], function(){
      callback();
    });
  },
  
  
  decryptUpdatedRecords: function(records, syncKey, callback){
    //decrypt the records ready to be inserted into the database
    //we need to use a background thread, because decrypting 100's of strings can take quite some time
    //and doing it in the main thread will cause the browser to become unresponsive
    
    //separate out the encrypted records into an array
    var encryptedData = [];
    for(var i=0; i<records.length; i++){
      encryptedData[i] = records[i].data;
    }
    
    //send to the worker to decrypt
    var worker = new Lazarus.Worker2('aes.js', 'js/');
    worker.call('Lazarus.AES.decryptArray', [encryptedData, syncKey], function(decryptedData, errMsg, err){
      if (errMsg){
        callback(null, errMsg, err);
      }
      else {
        //restore the decrypted strings back to the records
        for(var i=0; i<records.length; i++){
          records[i].data = decryptedData[i];
        }
        callback(records);
      }
    });
  },
  
  
  mergeUpdatedRecords: function(updatedRecords, syncKey, callback){
    
    Lazarus.Sync.decryptUpdatedRecords(updatedRecords, syncKey, function(records, errMsg, err){
      if (records !== null){
      
        for(var i=0; i<updatedRecords.length; i++){
          //if the record is corrupted, then we're going to have to ignore it,
          //otherwise we'll get the same record next time we request them
          try {
            updatedRecords[i].data = JSON.parse(updatedRecords[i].data);
          }
          catch(e){
            updatedRecords[i].data = null;
          }
        }
        
        //build the (possibly very large) list of queries to run against the database.
        var queries = [];
        for(var i=0; i<updatedRecords.length; i++){
          var rec = updatedRecords[i];
          if (rec.data){
            
            rec.data[rec.primaryKeyField] = rec.primaryKeyValue;
            rec.data['lastModified'] = rec.lastModified;
            //we actually want to do an "upsert" here, so if the record exists AND it's last modified time is less than ours 
            //then we want to update it. If the record doesn't exist, we want to create it.
            //AFAICT sqlite has no ON DUPLICATE KEY UPDATE syntax. It does have INSERT OR REPLACE, but that
            //will not allow us to use the if lastModified < x WHERE clause.
            //So we're going to have to run two statements each time :(
            var fields = Lazarus.Utils.mapKeys(rec.data);
            
            //security check
            var fieldStr = fields.join(',') +","+ rec.primaryKeyField;
            if (fieldStr.indexOf("'") > -1){
              //fields 
              Lazarus.logger.error("Sync: mergeUpdatedRecords: fields names are not allowed to contain single quotes (') \""+ fieldStr +"\"");
              callback(false);
              return;
            }
            else {
              var query1 = "INSERT OR IGNORE INTO {tableName} ("+ fields.join(",") +") VALUES ({"+ fields.join("},{") +"})";
              
              //build the second query
              var query2 = "UPDATE {tableName} SET";
              for(var field in rec.data){
                if (field != rec.primaryKeyField){
                  query2 += " "+ field +" = {"+ field +"},";
                }
              }
              //remove the final ","
              query2 = query2.replace(/,$/, '');
              query2 += " WHERE "+ rec.primaryKeyField +" = {"+ rec.primaryKeyField +"} AND lastModified < {lastModified}";
              
              rec.data.tableName = rec.tableName;
              
              queries.push(Lazarus.db.formatQuery(query1, rec.data));
              queries.push(Lazarus.db.formatQuery(query2, rec.data));
            }
          }
        }
        
        if (queries.length){
          //attempt to run the queries in a single transaction (makes it faster)
          Lazarus.logger.log('Sync: updating database...');
          Lazarus.db.transaction(queries, function(){
            Lazarus.logger.log('Sync: database updated');
            callback(true);
          });
        }
        else {
          callback(true);
        }
      }
      else {
        Lazarus.logger.error("Sync: mergeUpdatedRecords: failed to decrypt updated records");
        callback(false);
      }
    });
  },

  
  
  //fetch a list of changed records from the server
  getUpdatedRecords: function(userId, lastSyncTime, callback){
    Lazarus.getPref('syncKeyHash', function(syncKeyHash){
      Lazarus.Sync.callAPI("/sync/getUpdatedRecords", {
        userId: userId,
        lastSyncTime: lastSyncTime,
        syncKeyHash: syncKeyHash,
        clientTime: Lazarus.Utils.timestamp()
      }, function(response){
        callback(response);
      });
    });
  },
  
  
  sendToServer: function(userId, lastSyncTime, records, callback){
    //how many records do we have?
    //if more than 1000, we should probably break them up and send them in separate bunches
      
    var lastResponse = null;
    
    var sendFunc = function(){
      if (records.length > 0){
      
        Lazarus.logger.log('Sync: average record length '+ Math.floor(JSON.stringify(records).length / records.length));
        
        //grab the next 1000 records.
        var recs = records.splice(0, 1000);
        
        Lazarus.Sync.callAPI("/sync/update", {
          userId: userId,
          lastSyncTime: lastSyncTime,
          records: JSON.stringify(recs),
          clientTime: Lazarus.Utils.timestamp()
        }, function(response){
          Lazarus.logger.log('Sync: sendToServer', response);
          
          if (response.errorMessages){
            callback(response);
          }
          else {
            //move onto the next bunch
            lastResponse = response;
            sendFunc();
          }
        });
      }
      else if (lastResponse){
        //all done.
        callback(lastResponse);
      }
      //no records to send
      else {
        callback(true);
      }
    };
    
    sendFunc();
  },
  
  getRecordsToSync: function(lastSyncTime, syncKey, callback){
    //select all the records in the database that have been altered since the last sync time
    var tables = Lazarus.Sync.tables;
    
    var args = [];
    for(var table in tables){
      args.push([table, lastSyncTime, tables[table], syncKey]);
    }
    
    Lazarus.Utils.callAsyncs(Lazarus.Sync.getRecordsFromTable, args, function(results){
      var records = [];
      for(var i=0; i<results.length; i++){
        records = records.concat(results[i]);
      }
      callback(records);
    })
  },
  
  
  getRecordsFromTable: function(table, lastSyncTime, primaryKeyField, syncKey, callback){
    Lazarus.db.exe("SELECT * FROM {table} WHERE lastModified > {lastSyncTime}", {table: table, lastSyncTime: lastSyncTime}, function(rs){
      callback(Lazarus.Sync.convertToRecords(rs, table, primaryKeyField, syncKey));
    });
  },
  
  
  convertToRecords: function(rs, table, primaryKeyField, syncKey){
    var records = [];
    for(var i=0; i<rs.length; i++){
      
      var row = rs[i];
      
      //separate out the data to encrypt
      var data = {};
      for(var field in row){
        if (field != primaryKeyField && field != 'lastModified'){
          data[field] = row[field];
        }
      }
      
      var record = {
        primaryKeyField: primaryKeyField,
        primaryKeyValue: row[primaryKeyField],
        lastModified: row['lastModified'],
        tableName: table,
        data: Lazarus.AES.encrypt(JSON.stringify(data), syncKey)
      }
      if (Lazarus.Sync.shouldSyncRecord(record)){
        records.push(record);
      }
    }
    return records;
  },
  
  shouldSyncRecord: function(record){
    for(var i=0; i<Lazarus.Sync.ignoreRecords.length; i++){
      var ignore = Lazarus.Sync.ignoreRecords[i];
      if (record.tableName == ignore.tableName && record.primaryKeyField == ignore.primaryKeyField){
        return false;
      }
    }
    return true;
  },
  
  //
  callAPI: function(url, data, callback){
    Lazarus.getPrefs(['userId', 'syncServer'], function(prefs){
      var postData = Lazarus.Utils.extend(data, {
        userId: prefs.userId,
        apiVersion: Lazarus.Sync.API_VERSION,
        format: 'json'
      });
      Lazarus.logger.log("callAPI", url, postData);
      Lazarus.Background.ajax(prefs.syncServer + url, postData, function(response){
        //the sync api responds with an array of error objects if something goes wrong,
        //but background.ajax only responds with a single error message 
        //so we'll convert any ajax error into an api error object
        
        if (response.error){
          response.errors = [{
            id: 'error.ajax',
            msg: response.error
          }];
        }
        
        if (!response.errors){
          //Server send an invalid response
          Lazarus.logger.error("callAPI unrecognised response object", url, response);
          response.errors = [{
            id: 'sync.error.unrecognisedObject',
            msg: 'Server responded with an unrecognised response object'
          }];
        }
        
        //we want a simple way to test if there's been an error 
        //test now becomes "if (response.errorMessages)"
        if (response.errors.length > 0){
          response.errorMessages = [];
          for(var i=0; i<response.errors.length; i++){
            response.errorMessages.push(response.errors[i].msg);
          }
        }
        Lazarus.logger.log("callAPI response", url, response);
        callback(response);
      });
    });
  }

}