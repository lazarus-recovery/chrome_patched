


describe("Utils", function() {
	
  
	
	runTest("clone should be able to clone an array", function(){
		retVal = Lazarus.Utils.clone({fields: [{a:"a"}, {b:"b"}, {c:"c"}]});
	}, {fields: [{a:"a"}, {b:"b"}, {c:"c"}]});
  
  
  var str = "n:¤, dollar sign:$, cent sign:¢, euro sign:€, euro-currency sign:?, pound sign:£, yen sign:¥, copyright sign:©, registered sign:®, trade mark sign:™";
  
  runTest("base64Encode should be able to encode and decode unicode string", function(){
		var enc = Lazarus.Utils.base64Encode(str);
    retVal = Lazarus.Utils.base64Decode(enc);
	}, str);
  
  runTest("base64Encode should be return null if an invalid string is passed", function(){
		retVal = Lazarus.Utils.base64Decode("not a valid base64 string");
	}, null);
  
  runTest("decodeQuery should decode a URL query", function(){
		retVal = Lazarus.Utils.decodeQuery("a=b");
	}, {a: "b"});
  
  runTest("decodeQuery should be able to handle arrays of values", function(){
		retVal = Lazarus.Utils.decodeQuery("a=b&a=c&a=d");
	}, {a: ["b", "c", "d"]});
  
  
  //callAsyncs(fns, args, finalCallback)
  
  runTest("callAsyncs should call multiple asyncronous methods one after the other", function(){
    var s = '';
    var funcs = [
      function(callback){
        setTimeout(function(){
          s += "1";
          callback();
        }, 250)
      },
      
      function(callback){
        setTimeout(function(){
          s += "2";
          callback();
        }, 200)
      },
      
      function(callback){
        setTimeout(function(){
          s += "3";
          callback();
        }, 150)
      },
      
      function(callback){
        setTimeout(function(){
          s += "4";
          callback();
        }, 50)
      }
    ]
    var args = [[],[],[],[]];
    
    Lazarus.Utils.callAsyncs(funcs, args, function(){
      retVal = s;
    });
	}, "1234");
  
  
});