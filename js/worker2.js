/*
an improved and easier to handle worker object

=== Usage ===

[simple]

//IMPORTANT: scripts to load are RELATIVE TO THE LOCATION OF THIS FILE (worker2.js)!
//so if all of your javascript files are kept in js/ and you want to call a function in js/fibonacci.js
//then you need to pass "fibonacci.js" as the path to the file to load.

var worker = new Worker2('fibonacci.js');
worker.call('fibonacci', [7], function(result, error){
  alert(result);
});


[error checking]

worker.run('fibonacci', [], function(result, error){
  if (error){
    throw(error);
  }
  else {
    alert(result);
  }
});

*/


Lazarus.Worker2 = function(scriptURLs, pathToWorkerScript){

  var self = this;

  pathToWorkerScript = pathToWorkerScript || '';

  //scriptURLs can be a single script (string) or an array of scripts to load
  self.scriptURLs = (typeof scriptURLs === "string") ? [scriptURLs] : scriptURLs;
  
  //call a function inside the script
  self.call = function(funcName, args, callback){
  
    //load our improved worker
    //frakking chrome caching everything
    self.worker = new Worker(pathToWorkerScript + 'worker2-loader.js?'+ (new Date()).getTime());
    
    //args is optional
    if (typeof(args) === "function"){
      callback = args;
      args = [];
    }
    
    //setup message passing
    self.worker.onmessage = function(evt){
      var response = evt.data;
      
      if (response !== null){
        callback(response);
      }
      else {
        callback(null, "Null response from worker", evt);
      }
    }
    
    //capture errors 
    self.worker.onerror = function(evt){
      callback(null, "Worker error: "+ evt.message, evt);
    }
    
    //ask the worker to load the scripts to run
    self.worker.postMessage({
      importScripts: self.scriptURLs,
      funcName: funcName,
      args: args
    });
  }
}
