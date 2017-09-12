

Lazarus.FNV1a = function(str, seed, returnInt){
    
    //hash = offset_basis
    var hash = seed ? parseInt(seed, 16) : 2166136261;
    
    //only calculate the length once
    var len = str.length;
    
    //for each octet_of_data to be hashed
    for (var i=0; i<len; i++){
    
        hash ^= str.charCodeAt(i);
        
        //hash = hash * FNV_prime (apparently this bitshifting does the same thing)
        hash += ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24));
    }
		
		var num = Math.abs(Number(hash & 0x00000000ffffffff));
    
    return returnInt ? num : num.toString(16);
}

