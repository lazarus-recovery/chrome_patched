//TODO: show loading icon when doing long running actions

//TODO: better messages when setting up sync (needs a status area with "syncing/saving/prefs saved etc...")

Lazarus.Options = {

  //max expiry time is limited to 2 weeks for the free version
  MAX_EXPIRE_FORMS_DAYS: 14,
  
  ONE_DAY: 24 * 60 * 60,

	init: function(){
	
		Lazarus.getPref('debugMode', function(debugMode){

			Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
			Lazarus.logger.log("initalizing login page");
      
      Lazarus.locale.setStrings({
        'app.platform': Lazarus.platform,
        'app.build': Lazarus.build,
        'app.version': Lazarus.version
      });
		
			Lazarus.locale.localiseDOM(document);
		
			Lazarus.Preferences.init();
      //whenever a preference is saved, show the saved message
      Lazarus.Event.addListener("preferenceSaved", function(){
        $('#options-saved-msg').fadeIn(function(){
          setTimeout(function(){
            $('#options-saved-msg').fadeOut();
          }, 1500);
        })
      });

      
			Lazarus.Options.initTabs();
			Lazarus.Options.initSecurityTab();
			Lazarus.Options.initDisabledDomains();
			Lazarus.Options.initExpireForms();
			Lazarus.Options.initSyncTab();
			Lazarus.Options.checkForUpdates();
      
      $('#reset').click(function(){
        if (confirm(Lazarus.locale.getString('options.reset.confirm'))){
          //reset prefs
          Lazarus.msg("options.resettingPrefs", "loading");
          Lazarus.callBackground("Lazarus.resetPrefs", [function(){
            //rebuild database
            Lazarus.msg("options.rebuildingDatabase", "loading");
            Lazarus.callBackground("Lazarus.Background.rebuildDatabase", [function(){
              //and reload this page (so all the changes to the prefs are noted)
              //and show "all setting reset" message
              window.location.hash = "#success:options.preferencesReset";
              window.location.reload();
            }]);
          }]);
        }
      })
			
      //hitting enter when on a textbox with an onenter handler should click that button
      $('*[onenter]').keydown(function(evt){
        var KEY_ENTER = 13;
        if (evt.keyCode == KEY_ENTER){
          var id = $(this).attr('onenter');
          $('#'+ id).click();
        }
      });
      
      $('*[onescape]').keydown(function(evt){
        var KEY_ESCAPE = 27;
        if (evt.keyCode == KEY_ESCAPE){
          var id = $(this).attr('onescape');
          $('#'+ id).click();
        }
      });
      
		
			//close button closes the options dialog
			$("#close").live("click", function(){
				window.close();
			});	
			
			$("#database-rebuild").live("click", function(){
        Lazarus.msg("options.rebuildingDatabase", "loading");
				Lazarus.callBackground("Lazarus.Background.rebuildDatabase", [function(){
					Lazarus.msg("options.databaseRebuilt", "success");
				}]);
			})
			
			$('#unittests-run').live("click", function(){
				Lazarus.callBackground("Lazarus.openURL", [Lazarus.baseURI +"unit-tests.html"]);
			});
      
			//show messages on page load if appropriate
      if (window.location.hash){
        var m = window.location.hash.match(/#(\w+):([\w\.]+)$/);
        if (m){
          Lazarus.msg(m[2], m[1]);
          window.location.hash = '';
        }
      }
      
      
      $('#worker-aes-test').live('click', function(){
        var worker = new Lazarus.Worker2('aes.js', 'js/');
        worker.call('Lazarus.AES.encrypt', ['test string', 'passphrase'], function(encryptedString, error){
          if (error){
            alert(error);
          }
          else {
            alert(encryptedString);
          }
        });
      })
      
      
      $('#md5-test').live("click", function(){
        var endTime = Lazarus.Utils.microtime() + 1000;
        var c = 0;
        var str = "karl@interclue.com:password";
        while(Lazarus.Utils.microtime() < endTime){
          c++;
          str = Lazarus.MD5.hash(str);
        }
        alert(c +" iterations in 1 second ("+ str +")");
			});
      
      $('#overlay').fadeOut("fast", function(){
        $(this).hide();
      });
		});
    
    if (Lazarus.developer){
      Lazarus.Options.MAX_EXPIRE_FORMS_DAYS = 90;
    }
	},
  
  
  initDisabledDomains: function(){
    Lazarus.callBackground("Lazarus.Background.getSetting", ["disabledDomains", function(disabledDomains){
      var domains = Lazarus.Utils.mapKeys(disabledDomains);
      domains.sort();
      $('#disabled-domains').val(domains.join("\n"));
    }, {}]);
    
    $('#disabled-domains').change(function(){
      var domains = $(this).val().split(/\s+/);
      var newDomains = {};
      for(var i=0; i<domains.length; i++){
        var domain = Lazarus.Utils.trim(domains[i]);
        if (domain){
          //TODO: validate domain format xxx.xxx, add warning message on fail?
          newDomains[domain] = true;
        }
      }
      
      Lazarus.callBackground("Lazarus.Background.setSetting", ["disabledDomains", newDomains, function(){
        Lazarus.Event.fire('preferenceSaved', 'disabledDomains', newDomains);
      }]);
      
    });
  },
	
  
  initExpireForms: function(){
  
    $('#expire-forms-interval, #expire-forms-unit').bind('input change', function(){
      var expiryTime = $('#expire-forms-interval').val() * $('#expire-forms-unit').val();
      var maxTime = Lazarus.Options.MAX_EXPIRE_FORMS_DAYS * Lazarus.Options.ONE_DAY;
      if (expiryTime > maxTime){
        Lazarus.msg("options.expireForms.intervalTooLarge", "error", {days: Lazarus.Options.MAX_EXPIRE_FORMS_DAYS});
        //trigger the onchange event to the new values will be saved
				$('#expire-forms-interval').val(Lazarus.Options.MAX_EXPIRE_FORMS_DAYS).trigger('change');
        $('#expire-forms-unit').val(Lazarus.Options.ONE_DAY).trigger('change'); //days
				
      }
    })
  },
  
  
	initTabs: function(){
		//initalise tabs
		$('.tab-panel:not(:first)').hide();
		
		$(".tabs li a").click(function(e){
			e.preventDefault();
			e.stopPropagation();
			$(".tabs li a").removeClass('active');
			$(this).addClass('active');
			var tabId = this.href.match(/#(.*)$/)[1];
			$(".tab-panel").hide();
      $("#" + tabId).show();
		});
    
    if (Lazarus.developer){
      $('#developer-tab, #sync-tab').show();
    }
	},
  
  
  saveEncryptionType: function(){
    //if we have a password set, then use hybrid encryption,
    Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
      //if the user's password is set, then select the "require password" checkbox
      if (passwordSet){
        Lazarus.setPref("encryptionMethod", "hybrid");
      }
      //otherwise use none
      else {
        Lazarus.setPref("encryptionMethod", "none");
      }
    }]);
  },
  
  
  checkForUpdates: function(){
    //
    var $div = $('#update-check');
    $div.addClass("loading").text(Lazarus.locale.getString("options.updates.checking"));
    Lazarus.callBackground("Lazarus.Background.checkForUpdates", [true, function(response){
      $div.removeClass("loading");
      if (response){
        if (Lazarus.Utils.versionCompare(response.version, ">", Lazarus.version)){
          $div.addClass("update").html(Lazarus.locale.getString("options.updates.newVersionAvailable", response));
        }
        else {
          $div.addClass("success").text(Lazarus.locale.getString("options.updates.ok"));
        }
      }
      else {
        $div.addClass("error").text(Lazarus.locale.getString("options.updates.error"));
      }
    }]);
  },
  
  
  initSecurityTab: function(){
  
    //hide some stuff to begin with
    $('#encryption-password-box').hide();
    $('#encryption-password-change, #encryption-password-reset, #encryption-password-remove').hide();
    
    Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
      //if the user's password is set, then select the "require password" checkbox
      if (passwordSet){
        $('#encryption-checkbox').attr("checked", "true");
        //and show the change and reset passwords buttons
        $('#encryption-password-change, #encryption-password-reset').show();
      }
    }]);
    
    
    
    //checking the "require password" checkbox should open the set password dialog
    $('#encryption-checkbox').change(function(){
      if (this.checked){
        //open the Set Password dialog
        
        //hide the "enter old password" box because the user has no password set at this point
        $('#encryption-password-old-field').hide();
        //and show the "save" button
        $('#encryption-password-remove').hide();
        $('#encryption-password-save').show();
      
        $('#encryption-password-field, #encryption-password-confirm-field').show();
        $('#encryption-password-box').slideDown(function(){
          $('#encryption-password').focus();
        });
      }
      else {
        //if they are attempting to remove the existing password 
        //then they'll need to enter it to start with
        //for now, we'll re-check the checkbox, and uncheck it if they are successfull 
        $('#encryption-checkbox').attr('checked', true);
        
        Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
        
          if (passwordSet){
            //show the "enter old password" textbox before the user can remove their password
            $('#encryption-password-remove').show();
            $('#encryption-password-save').hide();
            
            $('#encryption-password-old-field').show();
            $('#encryption-password-field, #encryption-password-confirm-field').hide();
            $('#encryption-password-box').slideDown(function(){
              $('#encryption-password-old').focus();
            });
          }
          else {
            //No password set, so just close the set password block
            $('#encryption-password-box').slideUp();
            $('#encryption-checkbox').attr('checked', false);          
          }
        }]);
      }
    });
    
    
    //change password should open the change password dialog
    $('#encryption-password-change').click(function(){
      
      //open the Set Password dialog, and include the "old password" input as well
      $('#encryption-password-old-field, #encryption-password-field, #encryption-password-confirm-field').show();
      //make sure the save button is visible
      $('#encryption-password-remove').hide();
      $('#encryption-password-save').show();
            
      $('#encryption-password-box').slideDown(function(){
        $('#encryption-password-old').focus();
      });
    });
    
    
    //hitting save should save the new password
    $('#encryption-password-save, #encryption-password-remove').click(function(){
    
      var oldPassword = $('#encryption-password-old').val().trim();
      var newPassword = $('#encryption-password').val().trim();
      var conf = $('#encryption-password-confirm').val().trim();
      
      
      function saveNewPassword(){
      
        if (newPassword != conf){
          $('#encryption-password').focus();
          Lazarus.msg('error.passwords.do.not.match', 'error');
        }
        else {
        
          //all good, set the new password
          Lazarus.callBackground('Lazarus.Background.fetchPrivateKey', [oldPassword, function(privateKey){
            
            if (privateKey){
              Lazarus.callBackground('Lazarus.Background.savePrivateKey', [privateKey, newPassword, function(success){
                //and set the encryptionMethod preference
                var encryptionMethod = newPassword ? "hybrid" : "none";
                Lazarus.callBackground('Lazarus.setPref', ["encryptionMethod", encryptionMethod, function(){
                  Lazarus.Options.saveEncryptionType();
                  if (newPassword){
                    Lazarus.callBackground('Lazarus.Background.logout', [function(){
                      Lazarus.msg('password.set', 'success');
                      $('#encryption-password-change, #encryption-password-reset').show();
                    }])
                  }
                  else {
                    Lazarus.msg('password.removed', 'success');
                    $('#encryption-checkbox').attr('checked', false);   
                    $('#encryption-password-change, #encryption-password-reset').hide();
                  }
                  //and cleanup
                  $('#encryption-password-box').slideUp();
                  $('#encryption-password-old, #encryption-password, #encryption-password-confirm').val('');
                }]);
              }])
            }
            else {
              Lazarus.logger.error("Unable to load private key, incorrect password?");
              Lazarus.msg('error.unable.to.load.encryption.key', 'error');
            }
          }]);
        }
      }
      
      
      
      //are they changing their password, or setting a new one?
      if ($('#encryption-password-old').is(':visible')){
        //then check old password is correct
        Lazarus.callBackground('Lazarus.Background.attemptLogin', [oldPassword, function(success){
          if (success){
            saveNewPassword();
          }
          else {
            Lazarus.msg('error.wrong.password', 'error');
            $('#encryption-password-old').focus();
          }
        }]);
      }
      else {
        saveNewPassword();
      }
    });
    
    
    $('#encryption-password-reset').click(function(){
      if (confirm("Resetting the password will remove all saved forms from the database.\n\nAre you sure you want to reset the password?")){
        Lazarus.callBackground('Lazarus.Background.rebuildEncryptionKeys', [function(success){
          $('#encryption-checkbox').attr('checked', false);
          $('#encryption-password-change, #encryption-password-reset').hide();
          Lazarus.Options.saveEncryptionType();
          Lazarus.msg('password.reset', 'success');
        }])
      }
    });
    
    
    //clicking the cancel button should close the set password dialog
    $('#encryption-password-cancel').click(function(){
      $('#encryption-password, #encryption-password-confirm, #encryption-password-old').val('');
      $('#encryption-checkbox').attr('checked', false);
      $('#encryption-password-box').slideUp();
      
      //if the user is changing their password and they hit cancel, then DON'T uncheck the checkbox
      Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
        $('#encryption-checkbox').attr('checked', passwordSet);
      }]);
    })
  },
  
  
  initSyncTab: function(){
  
    $('#sync-login-box, #sync-create-account-box, #sync-enabled-box, #sync-setup-box').hide();
    
    $('#sync-login-warning-link').live("click", function(){
      //select the sync tab,
      $('#sync-tab').show().find('a').click();
      
      //and show the login box
      $('#sync-setup-box').show();
      $('#sync-login-box').hide().slideDown();
      //focus on login box
      $('#sync-login-password').focus();
    });
    
    Lazarus.getPref('syncEnabled', function(syncEnabled){
      if (syncEnabled){
        //check to see if sync is properly setup
        Lazarus.callBackground("Lazarus.Sync.checkSyncKey", [function(response){
          if (response.error && response.errorNum == Lazarus.Sync.ERROR_INCORRECT_SYNC_KEY){
            //show the warning
            $('div.sync-login-warning').show();
            //and show the login section
            $('#sync-setup-box').show();
            $('#sync-login-box').show();
          }
          else {
            //all good, show syncing box
            $('#sync-enabled-box').show();
          }
        }]);
      }
      else {
        $('#sync-setup-box').show();
      }
    });
    
    $('#sync-show-login').click(function(){
      $('#sync-create-account-box').slideUp();
      $('#sync-login-box').slideToggle();
      $('#sync-login-email').focus();
    });
    
    $('#sync-show-create-account').click(function(){
      $('#sync-login-box').slideUp();
      $('#sync-create-account-box').slideToggle();
      $('#sync-create-email').focus();
    });
    
  

    $('#sync-stop').click(function(){
      Lazarus.Options.stopSyncing();
    });
    
    $('#sync-login').click(function(){
      //hide any warning
      $('.sync-login-warning').hide();
      
      //send a request to the server asking for a user id
      var email = $.trim($('#sync-login-email').val());
      var password = $.trim($('#sync-login-password').val());
      
      if (!email){
        Lazarus.msg('error.emailRequired', 'error');
        $('#sync-login-email').focus();
      }
      else if (!password){
        Lazarus.msg('error.passwordRequired', 'error');
        $('#sync-login-password').focus();
      }
      else {
      
        Lazarus.msg('options.sync.loggingIn', 'loading');
        
        var passwordHash = Lazarus.Options.secureHash(password);
      
        //all good, send to server
        Lazarus.callBackground('Lazarus.Sync.callAPI', ['/user/login', {
          email: email,
          passwordHash: passwordHash
        }, function(response){
          if (response.errorMessages){
            Lazarus.msg(response.errorMessages, "error");
          }
          //all good logged in
          else {
            Lazarus.Options.login(response, password);
          }
        }]);
      }
    });
    
    $('#sync-reset-password-link').click(function(){
      //open the lost password page on the server
      Lazarus.getPref('syncServer', function(syncServer){
        var url = syncServer +'/user/resetPassword';
        Lazarus.callBackground('Lazarus.openURL', [url]);
      });
      return false;
    });
  
  
    $('#sync-create-account').click(function(){
      //hide any warning
      $('.sync-login-warning').hide();
      
      //send a request to the server asking for a user id
      var email = $.trim($('#sync-create-email').val());
      var password = $.trim($('#sync-create-password').val());
      var confirm = $.trim($('#sync-create-confirm').val());
      
      if (!email){
        Lazarus.msg('error.emailRequired', 'error');
        $('#sync-create-email').focus();
      }
      else if (!password){
        Lazarus.msg('error.passwordRequired', 'error');
        $('#sync-create-password').focus();
      }
      else if (password != confirm){
        Lazarus.msg('error.passwordsDoNotMatch', 'error');
        $('#sync-create-confirm').val('');
        $('#sync-create-password').val('').focus();
      }
      else {
        //all good, send to server
        var syncKey = Lazarus.Utils.randomStr(32);
        var passwordMD5 = Lazarus.MD5.hash(password);
        var encSyncKey = Lazarus.AES.encrypt(syncKey, passwordMD5);
        var passwordHash = Lazarus.Options.secureHash(password);
        var syncKeyHash = Lazarus.Options.secureHash(syncKey);
        
        //send the passwordHash (for user login verification) 
        //syncKeyHash (syncKey verification) and encrypted syncKey (to pass to other clients)
        //to be saved on the server        
        Lazarus.msg("options.sync.creatingAccount", "loading");
      
        Lazarus.callBackground('Lazarus.Sync.callAPI', ['/user/create', {
          email: email,
          passwordHash: passwordHash,
          encSyncKey: encSyncKey,
          syncKeyHash: syncKeyHash
        }, function(response){
          if (response.errorMessages){
            Lazarus.msg(response.errorMessages, "error");
          }
          else {
            //save the user id, and sync key for this user
            //either a new account was created, or the user has been logged in
            Lazarus.msg(response.msg, "success");
            Lazarus.Options.login(response, password);
          }
        }]);
      }
    });
    
    
    $('#sync-now').click(function(){
      Lazarus.msg("Syncing account...", "loading");
      Lazarus.callBackground('Lazarus.Sync.syncDatabase', [function(response){
        if (response.errorMessages){
          //check for sync key error
          for(var i=0; i<response.errors.length; i++){
            if (response.errors[i].id == "sync.error.incorrectSyncKey"){
              //account has been reset, user needs to reenter their new password
              Lazarus.Options.stopSyncing(function(){
                //show the login box
                $('#sync-create-account-box').slideUp();
                $('#sync-login-box').slideDown(function(){
                  Lazarus.msg("error.accountReset", "error");
                });
              });
              return;
            }
          }
          //otherwise it's just a "normal" error
          Lazarus.msg(response.errorMessages, "error");
        }
        else {
          Lazarus.msg("options.sync.success", "success");
        }
      }]);
    });
    
    
		//TODO: remove this/move to admin area?
    // $('#sync-reset').click(function(){
      // if (confirm('This will delete all your forms, on your local machine, and any you have synced.\nAre you sure you want to do this?')){
        // Lazarus.getPref('userId', function(userId){
          // Lazarus.callBackground('Lazarus.Background.ajax', [Lazarus.SYNC_SERVER +'user/delete', {userId: userId}, function(response){
            // Lazarus.setPref('userId', '', function(){
              // Lazarus.Background.setSetting('lastSyncTime', 0, function(){
                // Lazarus.setPref('syncKey', '', function(){
                  // Lazarus.setPref('syncEnabled', false, function(){
                    // Lazarus.callBackground("Lazarus.Background.rebuildDatabase", [function(){
                      // Lazarus.msg("options.database.rebuilt", "success");
                      // //and show the signup dialog
                      // $('#sync-enabled-box').slideUp();
                      // $('#sync-setup-box').slideDown();
                    // }]);
                  // });
                // });
              // });
            // });
          // }]);
        // });
      // }
    // });
  },
  
  
  
  
  stopSyncing: function(callback){
    Lazarus.setPref('syncEnabled', false, function(){
      Lazarus.setPref('syncKey', '', function(){
        Lazarus.setPref('userId', '', function(){
          Lazarus.callBackground('Lazarus.Background.setSetting', ['lastSyncTime', 0, function(){
            //hide this box, and show the sync setup box 
            $('#sync-enabled-box').slideUp();
            $('#sync-setup-box').slideDown(function(){
              if (typeof callback == "function"){
                callback();
              }
            });
          }]);
        });
      });
    });
  },
  
  
  secureHash: function(str){
    //we're going to hash the string multiple times to make it harder to brute force it,
    //in theory this means it'd take 1000 times longer to break
    var HASH_ITERATIONS = 1000;
    var hash = str;
    for(var i=0; i<HASH_ITERATIONS; i++){
      hash = Lazarus.MD5.hash(hash);
    }
    return hash;
  },
  
  
  
  login: function(response, password){
  
    Lazarus.logger.log("saving user", response, password);
    
    var syncKey = Lazarus.AES.decrypt(response.encSyncKey, Lazarus.MD5.hash(password));
    
    Lazarus.setPref('userId', response.userId, function(){
      Lazarus.setPref('syncKey', syncKey, function(){
        Lazarus.setPref('syncKeyHash', response.syncKeyHash, function(){
          Lazarus.setPref('syncEnabled', true, function(){
            
            //clear the password boxes
            $('#sync-login-password, #sync-create-password, #sync-create-confirm').val('');
            
            $('#sync-setup-box').slideUp();
            $('#sync-enabled-box').slideDown();
            
            //and then sync this account
            var func = response.newUser ? 'Lazarus.Sync.setupPrimarySync' : 'Lazarus.Sync.setupSecondarySync';
            
            Lazarus.msg('options.sync.syncing', 'loading');
            Lazarus.callBackground(func, [function(response){
              if (response.errorMessages){
                Lazarus.msg(response.errorMessages, "error");
              }
              else {
                Lazarus.msg('options.sync.success', 'success');
              }
            }]);
          }); 
        }); 
      }); 
    })
  },
  
	close: function(){
		setTimeout(window.close, 1);
	}
}



