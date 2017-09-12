/*

http://code.google.com/p/chromium/issues/detail?id=20773

this script is designed to fix a single bug in google chrome that prevents dymanically created iframes
from having content scripts injected into them. This should allow chrome pages to add event listeners
from the parent page to the dynamic iframes page if the iframes page remains an about:blank page

This script needs to be run with the pages NON-priviledge space, so you need an additional script to 
inject this script into every page.

*/

(function(){

  var fixIframe = {
  
    //path to code to insert into iframe (relative to chrome.extension.getURL() root).
    aboutBlankJS: 'js/fix-iframe-about-blank.js',
  
    id: 'fix-iframe-20773',
  
    initPriviledgedDoc: function(doc){
      //inject our script into the page
      fixIframe.injectScript(doc, chrome.extension.getURL('js/fix-iframe-madness.js'), fixIframe.id);
    },
    
    initUnpriviledgedDoc: function(doc){
      //find all the iframes currently on the page
      var scriptURL = doc.getElementById(fixIframe.id).src;
      
      fixIframe.injectScriptIntoFrames(doc, scriptURL);
      
      //and listen for any changes to the page so we can insert our script into any dymanically created frames
      doc.addEventListener('DOMNodeInserted', function(evt){
        fixIframe.onDOMNodeInserted(evt, scriptURL);
      }, false);
      
    },
    
    initFramedDoc: function(doc){
      console.log("code injected into framed document: "+ doc.URL);
      
      //inject the custom about:blank code
      var m = doc.getElementById(fixIframe.id).src.match(/^chrome\-extension:\/\/\w+\//);
      if (m){
        
        var scriptURL = m[0] + fixIframe.aboutBlankJS;
        //chrome caches the hell out of the js file
        scriptURL += (scriptURL.indexOf('?') > -1) ? '&' : '?';
        scriptURL += (new Date()).getTime();
        
        fixIframe.injectScript(doc, scriptURL);
      }
      else {
        throw Error('Unable to extract url from injected fix-iframe script');
      }
    },
    
    onDOMNodeInserted: function(evt, scriptURL){
      if (evt.target && evt.target.tagName){
        if (evt.target.tagName.toLowerCase() == "iframe"){
          fixIframe.injectScriptIntoFrames(evt.target.parentNode, scriptURL);
        }
        else {
          fixIframe.injectScriptIntoFrames(evt.target, scriptURL);
        }
      }
    },
    
    injectScriptIntoFrames: function(ele, url){
      var iframes = ele.getElementsByTagName('iframe');
      console.log("numOfFrames", document.URL, iframes.length);
      
      for(var i=0; i<iframes.length; i++){
        var frame = iframes[i];
        if (frame && frame.contentWindow && frame.contentWindow.document){
          fixIframe.injectScript(frame.contentWindow.document, url, fixIframe.id);
        }
      }
    },
    
    injectScript: function(doc, url, scriptId){
      if (!scriptId || !doc.getElementById(scriptId)){
        console.log('injecting script into '+ doc.URL);
        var script = doc.createElement('script');
        script.type = "text/javascript";
        script.src = url; 
        script.id = scriptId;
        doc.documentElement.appendChild(script);
      }
    }
  }
  
  //privileged
  if (window.chrome && window.chrome.extension){
    fixIframe.initPriviledgedDoc(document);
  }
  //unprivileged parent document
  else if (!document.defaultView.frameElement){
    fixIframe.initUnpriviledgedDoc(document);
  }
  //unprivileged about:blank page of a dymanically created iframe
  else {
    fixIframe.initFramedDoc(document);
  }

})();
