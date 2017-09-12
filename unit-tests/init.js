
Lazarus.logger = new Lazarus.Logger();

var databaseFilename = "%profile%/test.sqlite";
var undefined;
var retVal = undefined;


function runTest(title, testFn, assertion){
	
	//force ALL functions to be asyncronouus
	it(title, function(){
	
		this.addMatchers({
			toBeTheSameAs: function(val){
				return JSON.stringify(this.actual) === JSON.stringify(val)
			}
		});
	
		runs(function(){
			retVal = undefined;
			testFn();
		});
	
		waitsFor(function(){
			return (retVal !== undefined);
		}, 1000);	
			
		runs(function(){
			if (typeof assertion == "function"){
				assertion();
			}
			else {
				expect(retVal).toBeTheSameAs(assertion);
			}
		})
	});
}
