


describe("Database", function() {
	
	var db;
	
	runTest("should be able to open new database", function(){
		db = new Lazarus.Database(databaseFilename);
		//db = new Lazarus.Database("%profile%/test.sqlite");
		retVal = db;
	}, function(){
		return retVal !== null;
	});
	
  
	runTest("should be able to close a database", function(){
		db.close();
		retVal = db.connection;
	}, null)
	
	runTest("should be able to create a table", function(){
		db = new Lazarus.Database(databaseFilename);
		db.exe("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTOINCREMENT, textField TEXT, intField INT)", function(){
			db.getStr("SELECT name FROM sqlite_master WHERE type='table' AND name='test'", function(str){
				retVal = str;
				//so this is not called if an error occurs,
				//that's why the expect test should be located OUTSIDE of the actual function.
			})
		})
	}, 'test');
	
	runTest("should be able to drop a table", function(){
		db.exe("DROP TABLE test", function(){
			db.getStr("SELECT name FROM sqlite_master WHERE type='table' AND name='test'", function(str){
				retVal = str;
			})
		})
	}, '');
	
	
	//setup the testing table
	runTest("should be able to setup the test table", function(){
		db.exe("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, textField TEXT, intField INT)", function(){
			db.exe("INSERT INTO test (textField, intField) VALUES ('test', 1234)", function(){
				retVal = true;
			})
		})
	}, true);
	
	
	runTest("should be able to save a string", function(){
		db.getStr("SELECT textField FROM test WHERE textField='test'", function(str){
			retVal = str;
		})
	}, 'test');
	
	runTest("getInt() getStr should return an empty string if the record doesn't exist", function(){
		db.getStr("SELECT textField FROM test WHERE textField='non-existant'", function(str){
			retVal = str;
		})
	}, '');
	
	runTest("getInt() should be able to save a integer", function(){
		db.getInt("SELECT intField FROM test WHERE intField=1234", function(num){
			retVal = num;
		})
	}, 1234);
	
	runTest("getInt() should return 0 if no record exists", function(){
		db.getInt("SELECT intField FROM test WHERE intField=-1", function(num){
			retVal = num;
		})
	}, 0);
	
	runTest("exe() should return a recordset from a table", function(){
		db.exe("SELECT textField, intField FROM test WHERE intField=1234", function(rs){
			retVal = rs;
		})
	}, [{textField: 'test', intField: 1234}]);
	
	runTest("exe() should return an empty array if no records match the query", function(){
		db.exe("SELECT textField, intField FROM test WHERE intField=-1", function(rs){
			retVal = rs;
		})
	}, []);
	
	runTest("insert() should return an id when a record is inserted", function(){
		db.insert("INSERT INTO test (textField, intField) VALUES ('test2', 2)", function(id){
			retVal = id;
		})
	}, 2);
	
	runTest("insert() should return null when it fails to insert a record", function(){
		db.insert("INSERT INTO test (id, textField, intField) VALUES (2, 'test22', 22)", function(id){
			retVal = id;
		})
	}, null);
	
	runTest("insert() should return an id when a record is replaced", function(){
		db.insert("REPLACE INTO test (id, textField, intField) VALUES (2, 'test22', 22)", function(id){
			retVal = id;
		})
	}, 2);
	
	
	runTest("getColumn() should return an array of variables (strings, ints, etc..)", function(){
		db.getColumn("SELECT textField FROM test", function(col){
			retVal = col;
		})
	}, ['test', 'test22']);
	
	runTest("getColumn() should return an empty array if there are no records ", function(){
		db.getColumn("SELECT textField FROM test WHERE intField = -1", function(col){
			retVal = col;
		})
	}, []);
  
  runTest("db.transaction() should be able to run a multiple separate queries", function(){
    var queries = [
      "DELETE FROM test WHERE textField = 'transaction-test'",
      "INSERT INTO test (textField, intField) VALUES ('transaction-test', 0)",
      "UPDATE test SET intField = intField + 1 WHERE textField = 'transaction-test'",
      "UPDATE test SET intField = intField + 2 WHERE textField = 'transaction-test'",
      "UPDATE test SET intField = intField + 3 WHERE textField = 'transaction-test'",
    ]
    db.transaction(queries, function(){
      db.getInt("SELECT intField FROM test WHERE textField = 'transaction-test'", function(num){
        retVal = num;
      });
    });
	}, 6);
  
  runTest("db.transaction() should be able to run a single query multiple times", function(){
    db.exe("DELETE FROM test WHERE textField = 'transaction-test'", function(){
      db.exe("INSERT INTO test (textField, intField) VALUES ('transaction-test', 0)", function(){
        var args = [{field: 'transaction-test'}, {field: 'transaction-test'}, {field: 'transaction-test'}];
        db.transaction("UPDATE test SET intField = intField + 1 WHERE textField = {field}", args, function(){
          db.getInt("SELECT intField FROM test WHERE textField = 'transaction-test'", function(num){
            retVal = num;
          });
        });
      });
    });
	}, 3);
  
  runTest("db.transaction() should be able to run a single query with only one replacement", function(){
    db.exe("DELETE FROM test WHERE textField = 'transaction-test'", function(){
      db.exe("INSERT INTO test (textField, intField) VALUES ('transaction-test', 0)", function(){
        var args = [{field: 'transaction-test'}];
        db.transaction("UPDATE test SET intField = intField + 1 WHERE textField = {field}", args, function(){
          db.getInt("SELECT intField FROM test WHERE textField = 'transaction-test'", function(num){
            retVal = num;
          });
        });
      });
    });
	}, 1);
  
  
  runTest("db.tableExists() should return true if a table exists", function(){
    db.tableExists("test", function(exists){
      retVal = exists;
    });
	}, true);
  
  runTest("db.tableExists() should return false if a table doesn't exist", function(){
    db.tableExists("nonExistantTable", function(exists){
      retVal = exists;
    });
	}, false);
  
  runTest("db.tableExists() should return false if an invalid table name is given", function(){
    db.tableExists("table with / spaces in it's name", function(exists){
      retVal = exists;
    });
	}, false);
  
  runTest("formatQuery() should be able to format a simple query", function(){
    retVal = db.formatQuery("SELECT * FROM {table} WHERE id = {id}", {table: 'test', id: 8});
	}, "SELECT * FROM 'test' WHERE id = 8");
  
  runTest("formatQuery() should safely format passed parameters", function(){
    retVal = db.formatQuery("SELECT * FROM {table} WHERE id = {id}", {table: 'test', id: "Robert'); DROP TABLE students;--"});
	}, "SELECT * FROM 'test' WHERE id = 'Robert''); DROP TABLE students;--'");
  
  runTest("formatQuery() should be able to format a query where the replaceable parameters contain curly braces", function(){
    retVal = db.formatQuery("SELECT * FROM {table} WHERE id = {id}", {table: 'test', id: 'id-number-{4}'});
	}, "SELECT * FROM 'test' WHERE id = 'id-number-{4}'");
  
  runTest("formatQuery() should not throw an error if the query has already been formatted", function(){
    retVal = db.formatQuery("SELECT * FROM test WHERE id = 'some-id-with-{escaped}-curly-braces'");
	}, "SELECT * FROM test WHERE id = 'some-id-with-{escaped}-curly-braces'");
  
	
	it("formatQuery() should throw an error if there are missing replacements", function(){
		expect(function(){
			db.formatQuery("REPLACE INTO test (id, textField, intField) VALUES ({id}, {textField}, {intField})", {}, function(){})
		}).toThrow("formatQuery: missing replacement in query");
	})
	
});