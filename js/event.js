
Lazarus.Event = {
  
  handlers: {},
  
  addListener: function(name, handler){
    this.handlers[name] = this.handlers[name] || [];
    this.handlers[name].push(handler);
  },
  
  removeListener: function(name, handler){
    this.handlers[name] = this.handlers[name] || [];
    for(var i=this.handlers[name].length - 1; i>=0; i--){
      if (this.handlers[name][i] == handler){
        this.handlers[name][i].splice(i, 1);
      }
    }
  },
  
  fire: function(name){
    var data = [];
    for(var i=1; i<arguments.length; i++){
      data.push(arguments[i]);
    }
    var handlers = this.handlers[name] || [];
    Lazarus.logger.log("fire "+ name, "handlers = "+ handlers.length, data);
    for(var i=0; i<handlers.length; i++){
      handlers[i].apply(handlers, data);
    }
  }
}