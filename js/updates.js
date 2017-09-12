

Lazarus.Updates = {

  "166": function(callback){
    //updates to database schema
    Lazarus.Background.rebuildDatabase(callback)
  },
  
  
  "234": function(callback){
    //removing the hash seed so we can sync databases
    //hash seed *might* still be used for the encrypted full text index, we'll see
    Lazarus.Background.rebuildDatabase(callback)
  },
  
  
  "235": function(callback){
    //moving disabled domains into the database so they get synced
    Lazarus.getPref("disabledDomains", "", function(domainStr){
      var disabledDomains = domainStr.split(/\s*,\s*/g);
      var newDomains = Lazarus.Utils.arrayToMap(disabledDomains);
      Lazarus.Background.setSetting("disabledDomains", newDomains, function(){
        callback();
      });
    });
  }
  
  
  
  
  

}