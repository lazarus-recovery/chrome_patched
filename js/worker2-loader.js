
var globalContext = this;

this.onmessage = function(evt){

	var callbackInfo = evt.data;
  
  //inport the scripts to load
  for(var i=0; i<callbackInfo.importScripts.length; i++){
    try {
      importScripts(callbackInfo.importScripts[i]);
    }
    catch(e){
      throw Error("Unable to import worker script '"+ callbackInfo.importScripts[i] +"'.\nNOTE: imported scripts are relative to the location of the worker2.js file, not the html file!");
    }
  }
	
	//call the long running function
	var segments = callbackInfo.funcName.split(/\./g);
	var obj = globalContext;
	//we need to save the context ("this" object) for when we call the function
	while(segments.length > 0){
		var context = obj;
		obj = obj[segments[0]];
		if (!obj){
			throw Error("WorkerScript: "+ callbackInfo.funcName +" ["+ segments[0] +"] is not a background object or function");
		}
		segments.shift();
	}
  
	//check to make sure it's a function we are calling
	if (typeof obj === "function"){
    //and call it		
    var result = obj.apply(context, callbackInfo.args);
    //and pass the result back to the calling page
    postMessage(result);
	}
	else {
		//this will get caught by the worker onerror function
		throw Error("WorkerScript: "+ callbackInfo.funcName +" is a '"+ typeof obj +"' not a background function");
	}
}


