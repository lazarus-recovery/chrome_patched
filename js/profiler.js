




var Profiler = function(title){
    
    //name of this instance
    this.title = title || '';
    
    /**
    * return the current epoc in seconds
    */
    this.timestamp = function(){
        return new Date().getTime() / 1000;
    }
    
    //start time
    this.startTime = this.timestamp();
    
    //array of points marked by code
    this.log = [];
    
    /**
    * mark a point in the code
    */
    this.mark = function(title){
        this.log.push({
            "title": title,
            "time": this.timestamp()
        })    
    }
    
    /**
    * stops the profiler and returns the profiler log as a string
    */
    this.stop = function(title){
        this.mark(title);
        var msg = this.title +"\n";
        var lastTime = this.startTime;
        for (var i=0; i<this.log.length; i++){
            var item = this.log[i];
            var elapsed = item.time - lastTime;
            lastTime = item.time;
            msg += this.fix(elapsed, 3, true) +": "+  item.title +"\n";
            if (i == this.log.length -1){
                msg += "total time "+ this.fix(item.time - this.startTime, 3, true) +" seconds";
            }
        }
        
        return msg;
    }
    
    /**
    * formats a number to the given decimal places
    */
    this.fix = function(num, dp, returnAsPaddedString){
        dp = dp || 0;
        
        var mult = Math.pow(10, dp);
        num = (Math.round(num * mult) / mult);
        
        if (returnAsPaddedString){
            //make sure num is a string
            var numStr = ""+ num;
            var bits = numStr.split(/\./, 2);
            bits[1] = bits[1] || '';

            for (var i=bits[1].length; i<dp; i++){
                bits[1] += '0';
            }

            return bits.join('.');
        }
        else {
            return num;
        }
    }
}
