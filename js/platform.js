/*
Platform specific code that should overwrite any platform stub functions 
NOTE: this file needs to be loaded after any other library files, but BEFORE any other code is evaluated
*/

Lazarus.platform = "chrome";

Lazarus.baseURI = chrome.extension.getURL('');

Lazarus.preferencePrefix = "lazarus.preference.";
 
/**
* return a preference
*/
Lazarus.getPref = function(prefName, defaultVal, callback){
  if (typeof defaultVal == "function"){
    callback = defaultVal;
    defaultVal = null;
  }

	var name = Lazarus.preferencePrefix + prefName;

	if (Lazarus.environment == "background"){
		var val;
		if (localStorage && localStorage[name]){
			val = JSON.parse(localStorage[name]);
		}
		else if (typeof Lazarus.prefs[prefName] !== "undefined"){
			val = Lazarus.prefs[prefName];
		}
    else if (defaultVal !== null && typeof defaultVal != "undefined"){
      val = defaultVal;
    }
		else {
			throw Error("Unknown preference '"+ prefName +"'");
		}
		
		setTimeout(function(){
			callback(val);
		}, 1);
	
	}
	else {
		Lazarus.callBackground("Lazarus.getPref", [prefName, callback]);
	}
}
	

/**
* set a preference
*/
Lazarus.setPref = function(prefName, val, callback){

	callback = callback || function(){}

	var name = Lazarus.preferencePrefix + prefName;
	
	if (Lazarus.environment == "background"){
    Lazarus.getPref(prefName, function(oldVal){
      if (val !== oldVal){
        if (val === null){
          localStorage.removeItem(name);
        }
        else {
          localStorage[name] = JSON.stringify(val);
        }
        Lazarus.Event.fire("preferenceChange", prefName, val, oldVal);
      }
      callback(true);
    })
	}
	else {
		Lazarus.callBackground("Lazarus.setPref", [prefName, val, callback]);
	}
}


/**
* reset all preferneces back to their default values
**/
Lazarus.resetPrefs = function(callback){
	
	callback = callback || function(){}
	
	for (var key in localStorage){
		if (key.indexOf(Lazarus.preferencePrefix) === 0){
			localStorage.removeItem(key);
		}
	}
	setTimeout(function(){
		callback(true);
	}, 1);
}


/**
* call a function on the background page
**/
Lazarus.callBackground = function(funcName, args){

	args = args || [];
    
	var callbackInfo = {
		cmd: "call-background",
		funcName: funcName,
		args: args,
		callbackIndex: -1
	};
	
	if (Lazarus.logger){
		Lazarus.logger.log("call-background", funcName, callbackInfo);
	}
	//does the background function require a callback argument?
	var callback = null;
	for (var i=0; i<args.length; i++){
		//we'll assume that the background function only has one function argument, and that argument is the callback function
		if (typeof args[i] == "function"){
			if (callbackInfo.callbackIndex != -1){
				//bugger a callback function has already been defined.
				throw Error("callBackground function can take at most ONE function argument. More than one given. "+ args);
			}
			else {
				callback = args[i];
				callbackInfo.callbackIndex = i;
				callbackInfo.args[i] = null;
			}
		}
	}
  
	if (callback){
    //now send a request to the background page
    chrome.extension.sendRequest(callbackInfo, function(response){
			if (Lazarus.logger){
				Lazarus.logger.log("call-background-response", response);
			}
      if (response.success){
        callback(response.result);
      }
      else {
        callback(null);
      }
    });
  }
  else {
    chrome.extension.sendRequest(callbackInfo);
  }
}
/**
* handle a call background result
**/
Lazarus.onCallBackground = function(request, sender, sendResponse){
	//send back a copy of the request
	if (Lazarus.logger){
		Lazarus.logger.log("background request recieved", request);
	}
	var response = request;
	response.success = false;
	
	if (request.cmd == "call-background"){
		//is the function to call syncronous or asyncronous?
		var callbackInfo = request;
		var segments = callbackInfo.funcName.split(/\./g);
		var obj = window;
		//we need to get the correct context ("this" object) for when we call the function
		var context = window;
		while(segments.length > 0){
			context = obj;
			obj = obj[segments[0]];
			if (!obj){
				sendResponse(null);
				throw Error("onCallBackground: "+ callbackInfo.funcName +" ["+ segments[0] +"] is not a background object or function");
			}
			segments.shift();
		}
		//check to make sure it's a function we are calling
		if (typeof obj === "function"){
			//and call it
			//if the caller has passed a function argument, then we will assume that the first function argument is a callback.
			
			if (callbackInfo.callbackIndex > -1){
				//the function to call requires a callback function itself.
				//so we'll have to add a callback to the arguments, and capture the result
				//before sending the response
				//The callback function will be the callbackInfo.callbackIndex(th) argument.
				var args = callbackInfo.args;
				args[callbackInfo.callbackIndex] = function(result){
					response.result = result;
					response.success = true;
					sendResponse(response);
				};
				obj.apply(context, args);
			}
			else {
				response.result = obj.apply(context, callbackInfo.args);
				response.success = true;
				//and pass the result back to the calling page
				sendResponse(response);
				return;
			}
		}
		else {
			sendResponse(null);
			throw Error("onCallBackground: "+ callbackInfo.funcName +" is not a background function");
		}
	}
	else {
		//always send a response (otherwise memory leaks occur?)
		sendResponse(response);
	}
}


/**
* opens a url in a new tab and focuses on said tab
**/
Lazarus.openURL = function(url){
	var fullURL = (!url.match(/^[\w\-]+:/)) ? (document.URL.replace(/[#\?].*$/, '').replace(/[^\/]*$/, '') + url) : url;
		
	chrome.tabs.getAllInWindow(null, function(tabs){
		for(var i=0; i<tabs.length; i++){
			var tab = tabs[i];
			if (tab.url == fullURL){
				//select this tab
				chrome.tabs.update(tab.id, {selected:true});
				return;
			}
		}
		//no tab selected, create a new tab
		chrome.tabs.create({url:url});
	});
}

/*
load the manifest file for a given extension 
*/
// Lazarus.loadManifest = function(callback){
  // var url = Lazarus.baseURI +'manifest.json';
  // Lazarus.Background.ajax(url, function(response){
    // console.log(response);
  // });
// }
