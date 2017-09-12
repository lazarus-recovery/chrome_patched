
Lazarus.Preferences = {
	init: function(){

		var $inputs = $('input[preferenceid], textarea[preferenceid], select[preferenceid]');
		
		//set initial values for the preferences
		$inputs.each(function(){
			var input = this;
			var prefId = $(input).attr("preferenceid");
			Lazarus.getPref(prefId, function(currPref){
      
        //console.log("setting pref", prefId, currPref, input.type);
        switch($(input).attr("datatype")){
          case "csv":
            //convert to line-separated-values, and order them nicely
            var values = currPref.split(/\s*,\s*/g);
            for(var i=values.length-1; i>=0; i--){
              if (values[i] == ""){
                values.splice(i, 1);
              }
            }
            values.sort();
            $(input).val(values.join("\n"));
          break;
          
          //checkbox
          case "bool":
            input.checked = currPref;
          break;
          
          //checkbox
          case "string":
            input.value = currPref;
          break;
         
          //all others
          default:
            $(input).val(currPref);
          break;
        }
			});
		});
		

		//attach handlers to all the preference inputs
		$inputs.change(Lazarus.Preferences.onChange);
		$inputs.bind("input", Lazarus.Preferences.onChange);
	},
  
  onChange: function(evt){
    var prefId = $(this).attr("preferenceid");
    var val = ($(this).attr("type") == "checkbox") ? $(this).attr("checked") : $.trim($(this).val());
    
    switch($(this).attr("datatype")){
      case "bool":
        val = !!val;
      break;
        
      case "int":
        val = parseInt(val) || 0;
      break;
      
      case "csv":
        //convert from the line/space separated values back to comma separated values when saving
        val = val.split(/\s+/g).join(",");
      break;
      
      //checkbox
      case "string":
        //do nothing
      break;
      
      default:
        throw Error("Unknown or missing datatype ["+ $(this).attr("datatype") +"]");
    }
    
    //and save the new value
    //Lazarus.logger.log("saving preference", prefId, val);
    Lazarus.getPref(prefId, function(origVal){
      if (val != origVal){
        Lazarus.setPref(prefId, val);
        Lazarus.Event.fire('preferenceSaved', prefId, val);
      }
    });
  } 
} 