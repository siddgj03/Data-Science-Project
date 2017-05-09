/////////////////////////////////////////////
// Abstraction for DB commands using mssql //
/////////////////////////////////////////////

var sql = require('mssql');

var config = require('./config.json');

// var connection = new sql.Connection(config.db.config);

module.exports = {
	select: function(query, callback) {

		sql.connect(config.db.creds).then(function() {

			// Use the query string

		    // Query
		    new sql.Request()
		    .query(query).then(function(recordset) {
		    	callback(false, recordset);
		    }).catch(function(err) {
		        callback(err, null);
		    });

		}).catch(function(err) {
		    callback(err, null);
		});
	},
	/**
	 * Executes a Stored Procedure
	 * @param  {string} name   		- Name of the sproc
	 * @param  {Object|json} params - JSON object of the params, classified "in" and "out"
	 * @return {}        [description]
	 */
	sproc: function(name, params, callback) {
		name = "dbo." + name;
		sql.connect(config.db.creds).then(function() {

			// console.log("\nConnected! Executing sproc: " + name);

			var req = new sql.Request();

			// Loop through the params and add .input/.output for each
			// NOTE: No need to prepend @ sign
			for (var i = 0; i < params.in.length; i++) {
				var param = params.in[i];
				req.input(param.key, param.value);
				// console.log(param.key + " = " + param.value);
			}
			for (var i = 0; i < params.out.length; i++) {
				var param = params.out[i];
				req.input(param.key, param.value);
				// console.log(param.key + " = " + param.value);
			}

			req.execute(name).then(function(recordsets) {
		    	// console.dir(recordsets);
		    	return callback(false);
		    }).catch(function(err) {
				console.log(params);
		    	return callback(err);
		    });

		    // Alternative example: Specify data type
		    // .input('input_parameter', sql.Int, value)
		    // .output('output_parameter', sql.VarChar(50))

		}).catch(function(err) {
		    return callback(err);
		});

	}
};