
(function(namespace){

  if (!namespace.AES){throw Error("Crypto requires AES.js")}
  if (!namespace.RSA){throw Error("Crypto requires RSA.js")}

  // public
  
  namespace.Crypto = {
    
    
    /**
    * Hybrid encrypts a string with the given 
    */
    encrypt: function(str, RSAPublicKey, keyLength){
    
      keyLength = keyLength || 16;
      
      var randKey = randomStr(keyLength);
      
      //encrypt the data with the random key
      var encData = namespace.AES.encrypt(str, randKey);
      
      //and encrypt the key with our public/private key encryption
      var encKey = namespace.RSA.encrypt(randKey, RSAPublicKey);
      
      //and return the encrypted key with the data
      
      //first byte is the length of the encrypted key
      var ch = String.fromCharCode(encKey.length);
      
      return ch + encKey + encData;
    },
    
    decrypt: function(encrypted, RSAPrivateKey){
      //first byte is the length of the encrypted key
      var len = encrypted.charCodeAt(0);
      
      var encKey = encrypted.substr(1, len);
      var encMsg = encrypted.substr(len + 1);
        
      //decode the random key
      var randKey = namespace.RSA.decrypt(encKey, RSAPrivateKey);
      
      //if we are attempting to decode something that has been encrypted with 
      //another key, then it will fail (randKey === null)
      
      //then decode the message
      return randKey ? namespace.AES.decrypt(encMsg, randKey) : null;
    },
    
    
    pack: function(key){
      return btoa(JSON.stringify(key));
    },
    
    unpack: function(packedKey){
			try {
				return JSON.parse(atob(packedKey));
			}
			catch(e){
				return null;
			}
    },
		
		generateKeyPair: function(bits, publicExponent){
			return namespace.RSA.generateKeyPair(bits, publicExponent);
		}
  }; 
  
  
  // private
  
  
  /**
  * generate a string of random ascii characters of a given length 
  */
  function randomStr(len){
    var str = '';
    for (var i=0; i<len; i++){
        //use acsii characters from 32-126
        var ch = Math.floor(Math.random() * (126 - 32)) + 32;
        str += String.fromCharCode(ch);
    }
    return str;
  }

})(Lazarus);