//setup our namespace

var Lazarus = {

  version: "3.0.5",

	build: 406,
  
  developer: false,
  
	//FIXME: move to separate module
	msg: function(msg, type, replacements){
    if (typeof msg == "string" && msg.match(/^[\w\.]*$/)){
      msg = Lazarus.locale.getString(msg, replacements, false);
    }
    if (window.$ && window.$.msg){
      $.msg(msg, type);
    }
    else {
      alert(msg);
    }
	},
  
  getPrefs: function(prefs, callback){
    var values = {};
    
    var getNextPref = function(){
      if (prefs.length > 0){
        var pref = prefs.shift();
        Lazarus.getPref(pref, function(val){
          values[pref] = val;
          getNextPref();
        });
      }
      else {
        callback(values);
      }
    }
    getNextPref();
  }
	
	//TODO: implement setPrefs?
};

