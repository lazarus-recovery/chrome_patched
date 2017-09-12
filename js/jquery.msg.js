
/**
* shows a friendly message to the client
*/
jQuery.msg = function(msg, type, title, maxDisplayTime){
	
  
  jQuery.msg.state = "showing";
  
  //default to message
  type = type || "message";
  
  jQuery.msg.type = type;
  
  if (!title && type != "message"){
    title = type;
  }
  
  //special case 'loading'
  if (!maxDisplayTime){
    maxDisplayTime = 2500;
  }
  
  //build the box if it doesn't exist
  if (!jQuery.msg.$box){
    $('body').append('<div id="jquery-msg-box">\
      <h3 id="jquery-msg-title"></h3>\
      <div id="jquery-msg-body"></div>\
      <div id="jquery-msg-footer"></div>\
      <a id="jquery-msg-close"></a>\
    </div>');
   
    jQuery.msg.$box = $('#jquery-msg-box');	 
    jQuery.msg.$box.hide();
    
    $('#jquery-msg-close').click(function(){
      jQuery.msg.hide();
    });
    
    $(document).click(function(){ 
      if (jQuery.msg.type != 'loading' && !$('#jquery-msg-box').is(':animated')){
        jQuery.msg.hide();
      }
    });		
    
    //hide the message box on keypress
    $(document).keydown(function(evt){
      if (jQuery.msg.type != 'loading'){
        var KEY_ENTER = 13;
        var KEY_ESCAPE = 27;
        
        if (evt.keyCode == KEY_ENTER || evt.keyCode == KEY_ESCAPE){
          jQuery.msg.hide();
        }
      }
    })
  }
  
  //set title
  if (title){
    $("#jquery-msg-title").text(title).show();
  }
  else {
    $("#jquery-msg-title").hide();
  }
  //set body
  if ($.isArray(msg)){
    var $ul = $('<ul></ul>');
    for(var i=0; i<msg.length; i++){
      $ul.append($('<li></li>').text(msg[i]));
    }
    $('#jquery-msg-body').empty().append($ul);
  }
  else {
    $('#jquery-msg-body').text(msg);
  }
  
  jQuery.msg.$box[0].className = '';
  if (type){
    //remove all classes from the message box
    jQuery.msg.$box.addClass("jquery-msg-"+ type);
  }
  
  if (jQuery.msg.timer){
    clearTimeout(jQuery.msg.timer);
  }
  
  if (jQuery.msg.type == 'loading'){
    $('#jquery-msg-close').hide();
  }
  else {
    $('#jquery-msg-close').show();
  }
  
  var onShow = function(){
    $('#jquery-msg-close').focus();
    if (jQuery.msg.state == "showing"){
      jQuery.msg.state = "shown";
    }
    if (jQuery.msg.type != 'loading' && maxDisplayTime != -1){
      jQuery.msg.timer = setTimeout(function(){
        jQuery.msg.hide();
      }, maxDisplayTime);
    }
  }
  
  if (!jQuery.msg.$box.is(':visible')){
    //show the message
    var boxTop = (window.innerHeight / 4);
     
    $('#jquery-msg-box').stop().css({'top': (boxTop + 100) +'px', opacity: 0}).show().animate({'top': boxTop - 25 +'px', opacity: 1}, "normal", function(){
      onShow();
    }).animate({top: boxTop +'px'})
  }
  else {
    onShow();
  }
}

/**
* hide the message box (if it's visible)
*/
jQuery.msg.hide = function(){
	if (jQuery.msg.timer){
		clearTimeout(jQuery.msg.timer);
	}
  if (jQuery.msg.state == "shown"){
    var currTop = $('#jquery-msg-box').offset().top;
    jQuery.msg.state = "hiding";
    $('#jquery-msg-box').animate({opacity: 0, top: (currTop + 100) +'px'}, function(){
      $(this).hide();
      if (jQuery.msg.state == "hiding"){
        jQuery.msg.state = "hidden";
      }
    });
  }
}
