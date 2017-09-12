

Lazarus.Login = {
  init: function(){
	
		Lazarus.getPref('debugMode', function(debugMode){

			Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
			Lazarus.logger.log("initalizing login page");
			
			$('#password-form').submit(function(){
				
				var password = $.trim($('#password').val());
				if (password){
					//attempt to login with the password provided
					Lazarus.callBackground("Lazarus.Background.attemptLogin", [password, function(success){
						if (success){
							//logged in
							Lazarus.dialog.sendResponse(true);
						}
						else {
							//incorrect password
							Lazarus.msg('error.wrong.password', 'error');
							//but leave the dialog open
						}
					}]);
				}
				else {
					$('#password').val('').focus();
				}
				
				//don't let the form submit
				return false;
			});
			
			//if the user hits cancel close the dialog
			$('#cancel').click(function(){
				Lazarus.dialog.sendResponse(false);
			});
			
			//or if they hit escape
			$(document).keydown(function(evt){
				var KEY_ESCAPE = 27;
				if (evt.keyCode == KEY_ESCAPE){
					Lazarus.dialog.sendResponse(false);
				}
			})
			
			//and focus on the password box to start
			$('#password').focus();
			
		});
  }
}
