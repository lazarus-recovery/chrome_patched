/*

Usage 

ns.logger = new ns.Logger("{namespace}", ns.Logger.LOG_LEVEL_MESSAGES);

*/

(function(ns){

	// == Public ==
	
	ns.Logger = function(prefix, logLevel){
	
		//string prepended to every message (to make filtering easier)
		this.prefix = prefix || '';
		
		//set default logging level
		this.logLevel = logLevel ? logLevel : ns.Logger.LOG_LEVEL_ERRORS;
		
		this.error = function(){
			this.logMessage(arguments, "error", ns.Logger.LOG_LEVEL_ERRORS);
		}
		
		this.warn = function(){
			this.logMessage(arguments, "warn", ns.Logger.LOG_LEVEL_WARNINGS);
		}
		
		this.log = function(){
			this.logMessage(arguments, "log", ns.Logger.LOG_LEVEL_MESSAGES);
		}
		
		this.formatObject = function(obj, depth){
			var MAX_DEPTH = 5;
			depth = depth || 0;
			if (depth >= MAX_DEPTH){
				return "...";
			}
			
			var undefined;
			
			switch(typeof obj){
				case "string":
					return '"'+ obj +'"';
				case "number":
				case "boolean":
					return "["+ typeof obj +"] "+ obj;
				case "function":
					return obj.toString().replace(/\n(\w\W)*/, '');
				
				default:
					switch(obj){
						case null:
							return "[null]";
						case undefined:
							return "[undefined]";
						default:
							var tabs = "";
							for(var i=0; i<depth; i++){
								tabs += "\t";
							}
							//array
							if (Object.prototype.toString.call(obj) === '[object Array]'){
								var str = "[array "+ obj.length +"][\n";
								for (var i=0; i<obj.length; i++){
									str += tabs +"\t["+ i +"] "+ this.formatObject(obj[i], depth+1) +"\n";
								}
								str += tabs +"]";
								return str;
							}
							//or object
							else {
								var str = "[object] {\n";
								for(var prop in obj){
									str += tabs +"\t"+ prop +"=";
									try {
										str += this.formatObject(obj[prop], depth+1);
									}
									catch(e){
										str += "?";
									}
									str += "\n";
								}
								str += tabs +"}";
								return str;
							}
						break;
					}
				break;
			}
		}
		
		//dump a  string representation of the object to the log 
		this.dump = function(obj){
			this.log(this.formatObject(obj));
		}
		
		this.logMessage = function(args, type, minLevel){
			if (this.logLevel >= minLevel){
				args = argsToArray(args);
				
				if (this.prefix){
					args.unshift(this.prefix);
				}
				
				//Chrome/Safari/Script+Firebug/ XUL+firebug?
				if (window.console && console[type] && console[type].apply){
					console[type].apply(console, args);
				}
				//IE 8 developer tools
				else if (window.console && console[type]){
					console[type](args.join("\n"));
				}
				//Xul (Firefox)
				else if (window.Components && window.Components.classes){
					this.logFirefoxMessage(args, type);
				}
			}
		}
		
		this.logFirefoxMessage = function(args, type){
			
			var msg = args.join("\n");
			
			var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
			if (type == "log"){
				consoleService.logStringMessage(msg);
			}
			else {
				var scriptError = Components.classes["@mozilla.org/scripterror;1"].createInstance(Components.interfaces.nsIScriptError);
				var flag = (type == "warn") ? scriptError.warningFlag : scriptError.errorFlag;
				//TODO handle errors better:
				//if (isError(args[0])){
				//	scriptError.init(msg, args[0].fileName, null, args[0].lineNumber, null, flag, "component javascript");
				//}
				//else {
					scriptError.init(msg, null, null, null, null, flag, "component javascript");
				//}
				consoleService.logMessage(scriptError);   
			}
		}
		
		this.test = function(){
			this.dump({
				str0: "",
				str1: "hello",
				bool0: false,
				bool1: true,
				int0: 0,
				int1: 1,
				null0: null,
				array0: [],
				array1: [1,2,3],
				obj0: {},
				obj1: {
					prop1: "prop1"
				}
			});
		}
	}
	
	ns.Logger.LOG_LEVEL_NONE = 1;
	ns.Logger.LOG_LEVEL_ERRORS = 2;
	ns.Logger.LOG_LEVEL_WARNINGS = 3;
	ns.Logger.LOG_LEVEL_MESSAGES = 4;
	
	// == Private ==	
	
	/**
	* return TRUE if object is an error object
	**/
	function isError(obj){
		//because (obj instanceof Error) doesn't always work
		return (obj && obj.stack && obj.message);
	}
	
	/**
	* convert an arguments object into an array
	**/
	function argsToArray(args){
		var found = [];
		for(var i=0; i<args.length; i++){
			found.push(args[i]);
		}
		return found;
	}
	
})(Lazarus);

