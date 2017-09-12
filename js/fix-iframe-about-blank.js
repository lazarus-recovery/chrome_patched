//this code is injected into every about blank page.
//IMPORTANT: this in unpriviledged code and does NOT have access to chrome.extension.* functionality
//this also means that it might conflict with code currently running on the page!


(function(){


  

  //we need to be able to send messages to the parent document
  //and have those messages passed on to our priviledged code 
  
  // document.body.style.backgroundColor = '#FF0000'
  
  // document.addEventListener('click', function(evt){
    // alert('click '+ evt.target);
  // }, false);

})();

