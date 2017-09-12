
//default preferences
Lazarus.prefs = {
	"testStr": "",
	"testInt": 0,
	"testBool": false,
	"testUni": "",
	"defaultValue": "defaultValue"
}


describe("Prefs", function(){
	
	var testStr = "testing";
	var testInt = 1234;
	var testBool = true;
	var testUni = "\u2660\u2663\u2665\u2666\u041F\u0440\u0430\u0301\u0432\u0434\u0430";
	
	runTest("should be able to save and retrieve a string", function(){
		Lazarus.setPref("testStr", testStr, function(){
			Lazarus.getPref("testStr", function(val){
				retVal = val;
			});
		});
	}, testStr);
	
	runTest("should be able to save and retrieve an integer", function(){
		Lazarus.setPref("testInt", testInt, function(){
			Lazarus.getPref("testInt", function(val){
				retVal = val;
			});
		});
	}, testInt);
	
	runTest("should be able to save and retrieve a boolean", function(){
		Lazarus.setPref("testBool", testBool, function(){
			Lazarus.getPref("testBool", function(val){
				retVal = val;
			});
		});
	}, testBool);
	
	runTest("should be able to save and retrieve a unicode string", function(){
		Lazarus.setPref("testUni", testUni, function(){
			Lazarus.getPref("testUni", function(val){
				retVal = val;
			});
		});
	}, testUni);
	
	
	runTest("should return the default value if one has not been user set", function(){
		Lazarus.getPref("defaultValue", function(val){
			retVal = val;
		});
	}, Lazarus.prefs["defaultValue"]);
	
	
	runTest("should be able to reset a value", function(){
		Lazarus.setPref("testStr", null, function(val){
			Lazarus.getPref("testStr", function(val){
				retVal = val;
			});
		});
	}, Lazarus.prefs["testStr"]);

	
	it("should throw an error if we attempt to retrieve a value for a key that doesn't exist", function(){
		expect(function(){
			Lazarus.getPref("non.existant.preference", function(val){
				retVal = val;
			});
		}).toThrow("Unknown preference 'non.existant.preference'");
	})
	
	runTest("should be able to reset all values back to their defaults", function(){
		Lazarus.resetPrefs(function(){
			Lazarus.getPref("testInt", function(val){
				retVal = val;
			});
		});
	}, 0);
	
});