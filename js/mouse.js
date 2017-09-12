Lazarus.Mouse = {

  screenX: 0,
  screenY: 0,
  lastEle: null,
  hoverDelay: 100,
  hoverTimer: 0,
  hoverListeners: [],
  
  initDoc: function(doc){
    Lazarus.Utils.addEvent(doc, "mousemove", Lazarus.Mouse.onMouseMove);
    Lazarus.Utils.addEvent(doc, "mouseout", Lazarus.Mouse.onMouseOut);
  },
  
  cleanupDoc: function(doc){
    Lazarus.Utils.removeEvent(doc, "mousemove", Lazarus.Mouse.onMouseMove);
  },
  
  
  onMouseMove: function(evt){
    Lazarus.Mouse.screenX = evt.screenX;
    Lazarus.Mouse.screenY = evt.screenY;
    Lazarus.Mouse.clientX = evt.clientX;
    Lazarus.Mouse.clientY = evt.clientY;
    Lazarus.Mouse.lastEle = evt.target;
    clearTimeout(Lazarus.Mouse.hoverTimer);
    Lazarus.Mouse.hoverTimer = setTimeout(Lazarus.Mouse.fireHoverEvent, Lazarus.Mouse.hoverDelay);
  },
  
  onMouseOut: function(){
    //leave the screen x and y for now
    Lazarus.Mouse.lastEle = null;
    clearTimeout(Lazarus.Mouse.hoverTimer);
  },
  
  //fire a "lazarus:hover" event on the lastEle
  fireHoverEvent: function(){
    if (Lazarus.Mouse.lastEle){
      var doc = Lazarus.Mouse.lastEle.ownerDocument;
      var evt = document.createEvent('MouseEvents');
      //ref: https://developer.mozilla.org/en/DOM/event.initMouseEvent
      //event.initMouseEvent(type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey, button, relatedTarget);
      evt.initEvent('lazarus:hover', true, true, doc.defaultView, 0, Lazarus.Mouse.screenX, Lazarus.Mouse.screenY, Lazarus.Mouse.clientX, Lazarus.Mouse.clientY);
      Lazarus.Mouse.lastEle.dispatchEvent(evt);
    }
  },
  
  
  //return TRUE if mouse is currently over the given element (or one of it's children)
  isOverEle: function(ele){
    var node = Lazarus.Mouse.lastEle;
    while(node){
      if (node === ele){
        return true;
      }
      else {
        node = node.parentNode;
      }
    }
    return false;
  }
  
}