
describe("Background", function() {

	//
	runTest("should be able to encrypt and decrypt a string using no encryption", function(){
		var encStr = Lazarus.Background.encrypt("testing...", "none");
		retVal = Lazarus.Background.decrypt(encStr);
	}, "testing...");
  
  
})