/*****

=== Lararus XMLHttpRequest listener ===

This code has been injected into the page by the Lazarus Browser extension.
It's purpose is to help us save "AJAXified" forms 

This should allows us to "listen in" on XMLHttpRequests sent by this page
If the request matches textboxes on the page then we *should* be able to save the contents of those 
fields so that they can be recovered if something goes wrong.

One day I'll write a FAQ entry that explains this a bit more, but for now you can email me (lazarus@interclue.com)
if you've got any questions about this

*****/
//hmmm, possible we might need to overwrite the setHeader() function as well so we can detect what type of encoding 
//is being used on the data being sent (eg application/x-www-form-urlencoded, application/json, etc...)

//overwrite the original xhr.open() 
XMLHttpRequest.prototype.lazarusOriginalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, async, user, password){
  //copy url and methods (we'll need them when we fire the send event)
  this.url = url;
  this.method = method;
  return this.lazarusOriginalOpen(method, url, async, user, password);
}

//overwrite xhr.send()
XMLHttpRequest.prototype.lazarusOriginalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(postData){
  //I should have used document.dispatchEvent() here
  //but AFAICT there is no way to add the postData to a "normal" event.
  //so instead I'm going to postMessage to this document's window (or frame) 
  //and listen for that instead.
  
  //bugger, have to set domain to '*' so that our content script can see it.
  //this poses a security risk (assume someone embedded Gmail into an iframe, and then listened for the postMessage calls :(
  //document.defaultView.postMessage(data, '*');
  
  //looks like we're going to have to use dispatchEvent and hook our data only some other eventType
  //if we use a Mutation Event then it'll only be visible to pages on the current domain
  //but because it's an event we'll be able to see it in our content script
  
  //totally cannot afford for any errors to prevent the original XHR from being sent!
  try {
    var data = JSON.stringify({
      postData: postData,
      url: this.url,
      method: this.method,
      docURL: document.URL
    });
    //hmmm, I wonder how long an attribute string can be?
    //successfully tested a string of length 16MB (chrome, safari, fx3, fx4).
    //I think that's probably good enough for now
    
    var evt = document.createEvent('MutationEvent');
    //initMutationEvent (typeArg, canBubbleArg, cancelableArg, relatedNodeArg, prevValueArg, newValueArg, attrNameArg, attrChangeArg)
    evt.initMutationEvent("LazarusXMLHttpRequestSend", true, false, null, '', data, 'LazarusData', 1);
    document.dispatchEvent(evt);
  }
  catch(e){
    //suppress all possible errors
  }
  
  //and call the original send function
  return this.lazarusOriginalSend(postData);
}
