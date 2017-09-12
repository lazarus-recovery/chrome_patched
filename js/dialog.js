
/*

Usage:

//show an iframed dialog box.
ns.dialog(url);

//show a modal dialog and call a callback function with the result
//NOTE: callback requires an HTML5 window.postMessage capable browser 
ns.dialog(url, callback, {modal:true});

//insert the dialog.js file into the urls page as well, and then use ns.dialog.sendResponse(msg) 
//to respond to the dialog request

*/

(function(ns){

  if (!ns.Utils){
    throw Error("dialog.js requires utils.js");
  }

  ns.dialog = function(url, options){
    return new dialog(url, options);
  }
  
  
  ns.dialog.defaults = {
    callback: function(){},
    width: 450,
    height: 200,
    modal: true,
    doc: document,
    overlayStyle: {
      opacity: 0.2,
      background: '#000000', 
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 99998
    },
        
    frameStyle: {
      position: 'fixed',
      left: '50%',
      top: '50%',
      zIndex: 99999
    }
  }
  
  
  ns.dialog.sendResponse = function(msg){
    //posts a message to the parent page
    window.parent.postMessage(JSON.stringify(msg), "*");
  }
  

  function dialog(url, options){
  
    var self = this;
    self.url = url;
    
    self.settings = ns.Utils.extend(ns.dialog.defaults, options);
    
    if (Lazarus.platform == "firefox"){
      //firefox's security restrictions prevent us from opening a chrome:// iframe 
      //within a webpage, so instead we'll have to use a popup dialog box :(
      var params = {
        url: url
      };  
      var features = ["chrome", "dialog", "centerscreen", "resizable=yes"];
      features.push("innerWidth="+ self.settings.width);
      features.push("innerHeight="+ self.settings.height);
      if (self.settings.modal){
        features.push("modal");
      }
      
      window.openDialog("chrome://lazarus/content/firefox-dialog.xul", "", features.join(","), params).focus();
      setTimeout(function(){
        self.settings.callback(params.returnVal);
      }, 1)
      return;
    }
    
    
    //setup message passing between the frames
    //NOTE: dialog page must use postMessage to pass it's response.
    self.iframeOrigin = '';
    
    var m = url.match(/^[\w\-]+:\/+[^\/]+/);
    if (m){
      self.iframeOrigin = m[0];
    }
    else {
      throw Error("Unable to extract origin from URL: "+ url);
    }
    
    
    self.handleMessage = function(msg){
      //ignore messages from other origins 
			//WTF: Safari has uppercased the self.iframeOrigin domain 
      if (msg.origin.toLowerCase() == self.iframeOrigin.toLowerCase()){
        self.hide(JSON.parse(msg.data));
      }
    }
    
    window.addEventListener("message", self.handleMessage, false);
    
    self.onkeydown = function(evt){
      var KEY_ESCAPE = 27;
      if (evt.keyCode == KEY_ESCAPE){
        self.hide();
      }
    }
    
    //build overlay (if required)
    if (self.settings.modal){
      //create the overlay to capture any events.
      //NOTE: the escape key (or clicking the overlay) should close the dialog (and return null to the callback)
      self.overlay = ns.Utils.ele('lazarusoverlay', {style:self.settings.overlayStyle}, null, self.settings.doc.body)
      
      ns.Utils.addEvent(self.overlay, "click", function(){
        self.hide(null);
      });
      ns.Utils.addEvent(self.settings.doc, "keydown", function(evt){
        var KEY_ESCAPE = 27;
        if (evt.keyCode == KEY_ESCAPE){
          self.hide();
        }
      });
    }
    
    var frameStyle = self.settings.frameStyle;
    
    frameStyle.width = self.settings.width +'px';
    frameStyle.height = self.settings.height +'px';
    frameStyle['margin-left'] = 0 - (self.settings.width / 2) +'px';
    frameStyle['margin-top'] = 0 - (self.settings.height / 2) +'px';
      
    //now build the new iframe
    self.iframe = ns.Utils.ele('iframe', {frameborder:'0', style:frameStyle, src:url}, null, self.settings.doc.body);
    
    self.hide = function(returnVal){
      //remove the postMessage listener
      window.removeEventListener("message", self.handleMessage, false);
      document.removeEventListener("keydown", self.onkeydown, false);
      
      //hide the overlay
      if (self.overlay){
        ns.Utils.remove(self.overlay);
      }
      
      //hide the iframe
      ns.Utils.remove(self.iframe);
      
      //and return the result
      self.settings.callback(returnVal);
    }
    
    //and show it
    if (self.overlay){
      self.overlay.style.display = 'block';
    }
    self.iframe.style.display = 'block';
  }

})(Lazarus);