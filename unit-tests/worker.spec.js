
describe("Workers", function() {

	runTest("Should be able to call simple functions", function(){
    var worker = new Lazarus.Worker2('../unit-tests/fibonacci.js', 'js/');
    worker.call('fibonacci', [20], function(result, err){
      if (err){
        throw Error(err);
      }
      retVal = result; 
    });
	}, 6765);
  
  //test replacement base64 encode/decode functions for Fx 3.6 
  var asciiStr = "";
  for(var i=0; i<256; i++){
    asciiStr += String.fromCharCode(i);
  }
  var encAsciiStr = window.btoa(asciiStr);
  
  runTest("worker AES btoa should return the same encoding as window.btoa for ASCII strings", function(){
    var worker = new Lazarus.Worker2('aes.js', 'js/');
    worker.call('btoa', [asciiStr], function(result, err){
      if (err){
        throw Error(err);
      }
      retVal = result; 
    });
	}, encAsciiStr);
  
  runTest("worker AES atob should return the same encoding as window.atob for ASCII strings", function(){
    var worker = new Lazarus.Worker2('aes.js', 'js/');
    worker.call('atob', [encAsciiStr], function(result, err){
      if (err){
        throw Error(err);
      }
      retVal = result; 
    });
	}, asciiStr);
  
  var str = '1234';
  var password = 'password';
  var encrypted = Lazarus.AES.encrypt(str, password);
  
  runTest("worker AES should be able to decrypt strings encrypted in non-workers", function(){
    var worker = new Lazarus.Worker2('aes.js', 'js/');
    worker.call('Lazarus.AES.decrypt', [encrypted, password], function(result, err){
      if (err){
        throw Error(err);
      }
      retVal = result; 
    });
	}, str);
  
  var uniStr = '☢☣☠☯♆☤♨';
  var uniPassphrase = '♠♣♥♦';
  var encryptedUnicode = Lazarus.AES.encrypt(uniStr, uniPassphrase);
  
  //encryption uses a random seed so no two encryption results are the same.
  //so we're going to have to test encryption and decryption at the same time
  runTest("worker AES should be able to decrypt unicode strings encrypted in non-workers", function(){
    var worker = new Lazarus.Worker2('aes.js', 'js/');
    worker.call('Lazarus.AES.decrypt', [encryptedUnicode, uniPassphrase], function(result, err){
      if (err){
        throw Error(err);
      }
      retVal = result; 
    });
	}, uniStr);
  
})