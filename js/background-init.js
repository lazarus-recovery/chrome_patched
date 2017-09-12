
Lazarus.getPref('debugMode', function(debugMode){

	Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
	Lazarus.logger.log("initalizing background");

	chrome.extension.onRequest.addListener(Lazarus.onCallBackground);

	Lazarus.db = new Lazarus.Database("lazarus3.sqlite");

	//and finally call the "normal" initalization
	Lazarus.Background.init(); 
  
  //check for other obsolete versions of Lazarus
  var ids = [
    'jeegcpkjocidnmnoihpmgekefnkdefee',
    'dfpibnmmfemgpiafemfhbnhebaicfido'
  ];
  
  for(var i=0; i<ids.length; i++){
    var warningShown = false;
    (function(){
      var id = ids[i];
      var img = new Image();
      img.onload = function(){  
        if (!warningShown){
          warningShown = true;
          if (confirm('WARNING: You appear to have more than one version of the Lazarus Chrome extension installed.\nClick "OK" to read how to fix this problem.')){
            Lazarus.openURL('http://lazarus.interclue.com/Multiple_versions_installed_side_by_side');
          }
        }
      }
      img.onerror = function(){
        //not installed, ignore
      }
      img.src = 'chrome-extension://'+ id +'/images/lazarus.png';
    })();
  }
  
  
  

});
