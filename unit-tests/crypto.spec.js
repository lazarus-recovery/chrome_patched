

var testStr = "tesing 1,2,3...";
var unicodeStr = ""; //"\u2660\u2663\u2665\u2666\u041F\u0440\u0430\u0301\u0432\u0434\u0430";


for(var i=0; i<65536; i++){
	unicodeStr += String.fromCharCode(i);
}

describe("AES", function() {

	//AES uses a random IV so we cannot be certain what the encrypted string will look like
	runTest("AES should be able to encrypt and decrypt a string", function(){
		var enc = Lazarus.AES.encrypt(testStr, "password");
		retVal = Lazarus.AES.decrypt(enc, "password");
	}, testStr)
	
	runTest("decrypt() should return null if the password is wrong", function(){
		var enc = Lazarus.AES.encrypt(testStr, "password");
		var dec = Lazarus.AES.decrypt(enc, "different-password");
		retVal = dec;
	}, null)
  
  runTest("decrypt() should return null if the encrypted string is invalid", function(){
		var enc = Lazarus.AES.encrypt(testStr, "password");
		var dec = Lazarus.AES.decrypt("---"+ enc, "password");
		retVal = dec;
	}, null)
	
	runTest("AES should be able to encrypt and decrypt Unicode characters", function(){
		var enc = Lazarus.AES.encrypt(unicodeStr, "password");
		retVal = Lazarus.AES.decrypt(enc, "password");
	}, unicodeStr)
	
	runTest("AES should be able to encrypt and decrypt a string when the passphrase contains Unicode characters", function(){
		var enc = Lazarus.AES.encrypt(testStr, unicodeStr);
		retVal = Lazarus.AES.decrypt(enc, unicodeStr);
	}, testStr)
  
  var origArr = [];
  for(var i=0; i<5; i++){
    origArr[i] = testStr + i;
  }
  
  var encArr;
    
  runTest("AES should be able to encrypt and decrypt an array of strings", function(){
    encArr = Lazarus.AES.encryptArray(origArr, "password");
		retVal = Lazarus.AES.decryptArray(encArr, "password");
	}, origArr);
  
   
  runTest("decryptArray should be able to handle an invalid string in the array without throwing an error", function(){
    encArr[3] = 'not a valid encrypted string';
    origArr[3] = null;
		retVal = Lazarus.AES.decryptArray(encArr, "password");
	}, origArr);
  
  runTest("decryptArray should return an empty array if one was passed", function(){
		retVal = Lazarus.AES.decryptArray([], "password");
	}, []);
  
})

describe("RSA", function() {

	var keys;
	
	//RSA can only handle encrypting very short strings (max length 53 chars)
	var unicodeStr = "\u2660\u2663\u2665\u2666\u041F\u0440\u0430\u0301\u0432\u0434\u0430";

	//AES uses a random IV so we cannot be certain what the encrypted string will look like
	runTest("RSA should be able to generate a key pair", function(){
		keys = Lazarus.RSA.generateKeyPair(512);
		retVal = (keys !== null);
	}, true)
	
	runTest("RSA should be able to encrypt and decrypt a string", function(){
		var enc = Lazarus.RSA.encrypt(testStr, keys.publicKey);
		retVal = Lazarus.RSA.decrypt(enc, keys.privateKey);
	}, testStr)
	
	runTest("decrypt() should return null if the password is wrong", function(){
		var newKeys = Lazarus.RSA.generateKeyPair(512);
		var enc = Lazarus.RSA.encrypt(testStr, keys.publicKey);
		retVal = Lazarus.RSA.decrypt(enc, newKeys.privateKey);
	}, null)
  
  runTest("decrypt() should return null if the encrypted string is invalid", function(){
		var enc = Lazarus.RSA.encrypt(testStr, keys.publicKey);
		retVal = Lazarus.RSA.decrypt("--"+ enc, keys.privateKey);
	}, null)
	
	runTest("RSA should be able to encrypt and decrypt Unicode characters", function(){
		var enc = Lazarus.RSA.encrypt(unicodeStr, keys.publicKey);
		retVal = Lazarus.RSA.decrypt(enc, keys.privateKey);
	}, unicodeStr);
	
})



describe("Hybrid Encryption", function(){

	var RSAKeys = Lazarus.RSA.generateKeyPair(512);
	
	var unicodeStr = "\u2660\u2663\u2665\u2666\u041F\u0440\u0430\u0301\u0432\u0434\u0430";

	runTest("should be able to encrypt and decrypt a string", function(){
		var enc = Lazarus.Crypto.encrypt(testStr, RSAKeys.publicKey);
		retVal = Lazarus.Crypto.decrypt(enc, RSAKeys.privateKey);
	}, testStr);
	
	runTest("should be able to encrypt and decrypt a Unicode string", function(){
		var enc = Lazarus.Crypto.encrypt(unicodeStr, RSAKeys.publicKey);
		retVal = Lazarus.Crypto.decrypt(enc, RSAKeys.privateKey);
	}, unicodeStr);
	
	runTest("decrypt() should return null if an incorrect key is used", function(){
		var newKeys = Lazarus.RSA.generateKeyPair(512);
		var enc = Lazarus.Crypto.encrypt(testStr, RSAKeys.publicKey);
		retVal = Lazarus.Crypto.decrypt(enc, newKeys.privateKey);
	}, null)
	
	
})
