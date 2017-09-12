
Lazarus.Menu = function(){

  var self = this;
  
  self.items = [];
  
  self.menuEle = null;
  
	//kludge, so we can tell how wide the menu is before actually showing it
  self.width = 210;
  
  self.styleEle = null;
  
  self.css = "lazarusmenu {\
      background: Menu url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAALHRFWHRDcmVhdGlvbiBUaW1lAFNhdCAxMyBOb3YgMjAxMCAwOTo0NjoxNSArMTIwMABkIFgAAAAHdElNRQfaCwwULhU/gv0rAAAACXBIWXMAAAsSAAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAAA9JREFUeNpjePT48f///wETSAWmuDmLnAAAAABJRU5ErkJggg==') repeat-y 28px 0px;\
      border: 1px solid #979797; \
      padding: 2px 2px 2px 2px; \
      font: menu; \
      -webkit-box-shadow: 2px 2px 1px rgba(127, 127, 127, 0.5);\
      color: #333; \
      width: 200px;\
      position: absolute;\
      top: 0px;\
      left: 0px;\
      z-index: 9999;\
      display: none;\
    }\
    lazarusmenuseparator {\
      display: block;\
      height: 0px; \
      margin-top: 3px;\
      margin-bottom: 3px;\
      margin-left: 28px;\
      border-top: 1px solid #E0E0E0;\
      border-bottom: 1px solid ThreeDHighlight;\
    }\
    lazarusmenuitem {\
      border: 1px solid transparent;\
      display: block;\
      height: 20px;\
      clear: both;\
      cursor: default;\
    }\
    lazarusmenuitem.disabled {\
      color: #888;\
    }\
    lazarusmenuitem:hover {\
      border: 1px solid #AECFF7;\
      border-radius: 3px;\
      background: #F2F4F6;\
      background: -moz-linear-gradient(top,  #F2F4F6,  #E6EDF6);\
      background: -webkit-gradient(linear, left top, left bottom, from(#F2F4F6), to(#E6EDF6));\
    }\
    lazarusmenuitemtext {\
      height: 20px;\
      line-height: 20px;\
      overflow: hidden;\
      white-space: nowrap;\
      text-overflow: ellipsis;\
      width: 165px;\
      padding-left: 8px;\
      display: block;\
      float: left;\
    }\
    lazarusmenuitemicon {\
      width: 25px;\
      height: 20px;\
      display: block;\
      float: left;\
    }";
    
  self.init = function(doc){
    doc = doc || document;
    
    //inject styles for this menu
    self.styleEle = Lazarus.Utils.injectCSS(self.css, doc);
    //and build the menuelement
    self.menuEle = Lazarus.Utils.ele('lazarusmenu', null, null, doc.documentElement);
  }
  
  self.addItem = function(text, options){
    var settings = Lazarus.Utils.extend(Lazarus.Menu.defaults, options);
    
    var menuitem = Lazarus.Utils.ele('lazarusmenuitem', {title:settings.tooltip}, null, self.menuEle);
    if (settings.disabled){
      menuitem.setAttribute("class", "disabled");
    }
    
    menuitem.data = Lazarus.Utils.clone(settings.data);
    
    Lazarus.Utils.addEvent(menuitem, "mousedown", function(evt){
      settings.onclick(evt);
      evt.stopPropagation();
      evt.preventDefault();
      self.hide();
      return false;
    });
    
    var iconStyle = settings.icon ? "background: url('"+ settings.icon +"') no-repeat center center" : "";
    menuitem.icon = Lazarus.Utils.ele('lazarusmenuitemicon', {style:iconStyle}, null, menuitem);
    menuitem.text = Lazarus.Utils.ele('lazarusmenuitemtext', null, text, menuitem);
    
    self.items.push(menuitem);
    return menuitem;
  }
  
  self.removeItem = function(index){
    if (self.items[index]){
      var item = self.items[index];
      item.parentNode.removeChild(item);
      self.items.splice(index, 1);
    }
    else {
      throw Error("removeItem: item "+ index +" doesn't exist");
    }
  }
  
  self.removeAll = function(){
    self.menuEle.innerHTML = '';
    self.items = [];
  }
  
  self.addSeparator = function(){
    self.items.push(Lazarus.Utils.ele('lazarusmenuseparator', null, null, self.menuEle));
  }
  
  self.remove = function(){
    if (self.menuEle.parentNode){
      self.menuEle.parentNode.removeChild(self.menuEle);
    }
    if (self.styleEle.parentNode){
      self.styleEle.parentNode.removeChild(self.styleEle);
    }
  }  
  
  self.position = function(left, top){
    self.menuEle.style.left = left +"px";
    self.menuEle.style.top = top +"px";
  }
  
  self.show = function(x, y){
    if (x || y){
      self.position(x, y);
    }
    self.menuEle.style.display = "block";
    
    Lazarus.Utils.addEvent(self.menuEle.ownerDocument, "mousedown", self.onDocClick);
  }
  
  self.onDocClick = function(evt){
    //if we click anything except the menu,
    if (!Lazarus.Utils.findParent(evt.target, "lazarusmenu")){
      //then hide the menu
      self.hide();
    }
    
  }
  
  self.hide = function(){
    self.menuEle.style.left = "-9999px";
    self.menuEle.style.top = "-9999px";
    self.menuEle.style.display = "none";
    Lazarus.Utils.removeEvent(self.menuEle.ownerDocument, "click", self.onDocClick);
  }
  
}

Lazarus.Menu.defaults = {
  tooltip: '',
  onclick: function(){},
  icon: '',
  data: null,
}