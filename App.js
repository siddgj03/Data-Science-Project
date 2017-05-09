/**
 * Main App file
 */

// Imports
var request = require('request'),
	moment = require('moment-timezone'),
	Entities = require('html-entities').AllHtmlEntities,
		entities = new Entities(),
	jsonfile = require('jsonfile'),
	Promise = require('promise');

var config = require('./config.json'),
	db = require('./db.js'),
	apiProgress = require('./api-progress.json');

// Log on Startup
var timeZone = "America/Los_Angeles";
var timeNow = moment().tz(timeZone);
console.log("\n--- NodeJS App by " + config.identity.name + " ---");
console.log('Launched: ' + timeNow.format() + " " + timeNow.tz(timeZone).zoneAbbr());
console.log("\n");

// User args
var args = process.argv.slice(2);
var cmdPath = args[0];
var cmdTag = args[1];
var resumeFromPage = args[2] ? parseInt(args[2]) : null;

// cmdPath Variables
var pathSiteInfo = "info";

var pathSearchQuestions = "questions";
var pathSearchAnswers = "answers";
var pathSearchPosts = "posts";
var pathSearchComments = "comments";
var pathSearchTags = "tags";
var pathSearchBadges = "badges";
var pathSearchUsers = "users";

var paths = [
	pathSearchQuestions, pathSearchAnswers, pathSearchUsers,
	pathSearchComments, pathSearchTags, pathSearchBadges,
	pathSearchBadges + "/name", pathSearchBadges + "/tags"
];

// Exit if cmdPath is not known
// if (paths.indexOf(cmdPath) < 0) {
// 	console.log('cmdPath: :"' + cmdPath + '" is invalid.');
// 	process.exit();
// }

// For now, this can ONLY be 1
var returnDataLimit = config.api.stackExchange.options.returnDataLimit;
var pagePerLoad = config.api.stackExchange.options.pagePerLoad;
var pageCompleted = 0;

// Get import progress from config
var doImportUserBadges = config.api.stackExchange.options.users.getBadges;
if (resumeFromPage == null && (cmdPath in apiProgress)) {
	console.log("Loading progress:");
	console.log(JSON.stringify(apiProgress[cmdPath], null, 4));
	if (cmdPath === pathSearchUsers) {
		progressPath = doImportUserBadges ? apiProgress[cmdPath].withBadge : apiProgress[cmdPath].only;
	} else if (cmdPath === pathSearchQuestions) {
		if (cmdTag) {
			// If tag doesn't have a progress json, add it
			if (!(cmdTag in apiProgress[cmdPath])) {
				apiProgress[cmdPath][cmdTag] = 0;
			}
		}
		progressPath = cmdTag ? apiProgress[cmdPath][cmdTag] : apiProgress[cmdPath].all;
	} else {
		progressPath = apiProgress[cmdPath];
	}
	resumeFromPage = progressPath + 1;
	console.log("Resuming loading "+cmdPath+" from page # " + resumeFromPage);
}
var getAllPages = config.api.stackExchange.options.getAllPages;
console.log("Get All Pages: " + getAllPages);

var savedRecords = [];

// Get specified command

doGetFromApi(cmdPath, cmdTag, savedRecords, function(err) {
	if (err) {
		console.log(err);
		return;
	}
	console.log("All "+cmdPath+" extracted, length: " + savedRecords.length);
	pageCompleted = Math.floor(savedRecords.length / returnDataLimit);

	// Get answers for each question
	if (cmdPath == pathSearchQuestions) {
		var allAns = [];
		getAssociatedData(savedRecords, pathSearchQuestions, "question_id", pathSearchAnswers, allAns, function(err) {
			if (err) {
				console.log(err);
				return;
			}
			console.log("All answers extracted, length: " + allAns.length);

			// Join Answer to Question and get Comments
			savedRecords = savedRecords.concat(allAns);
			var allComments = [];
			var possibleIds = ["question_id", "answer_id"];
			getAssociatedData(savedRecords, pathSearchPosts, possibleIds, pathSearchComments, allComments, function(err) {
				if (err) {
					console.log(err);
					return;
				}
				console.log("All comments extracted, length: " + allComments.length);

				// Save Progress
				if (resumeFromPage !== null) {
					var lastCompletedPage = resumeFromPage + (pageCompleted - 1);
					var file = './api-progress.json';
					var newProgress = apiProgress;
					if (cmdTag) {
						newProgress[pathSearchQuestions][cmdTag] = lastCompletedPage;
					} else {
						newProgress[pathSearchQuestions].all = lastCompletedPage;
					}
					console.log("Questions import progress: Page # " + lastCompletedPage);
					 
					jsonfile.writeFile(file, newProgress, {spaces: 4}, function (err) {
						if (err) {
							console.log(err);
							console.log("Last completed page progress for ["+cmdPath+"] = " + lastCompletedPage);
						} else {
							console.log("\n--- Job finished with no errors, please pull the config file from server ---\n");
						}
						console.log("Process duration: " + process.uptime());
					});
				}
			});
		});
	}
	// Get badges for each user
	else if (cmdPath == pathSearchUsers) {
		if (doImportUserBadges) {
			var allBadges = [];
			getAssociatedData(savedRecords, pathSearchUsers, "user_id", pathSearchBadges, allBadges, function(err) {
				if (err) {
					console.log(err);
					return;
				}
				console.log("All badges extracted, length: " + allBadges.length);
				// Save Progress
				if (resumeFromPage !== null) {
					var lastCompletedPage = resumeFromPage + (pageCompleted - 1);
					var file = './api-progress.json';
					var newProgress = apiProgress;
					newProgress[pathSearchUsers].withBadge = lastCompletedPage;
					console.log("Users import progress: Page # " + lastCompletedPage);
					 
					jsonfile.writeFile(file, newProgress, {spaces: 4}, function (err) {
						if (err) {
							console.log(err);
							console.log("Last completed page progress for ["+cmdPath+"] = " + lastCompletedPage);
						} else {
							console.log("\n--- Job finished with no errors, please pull the config file from server ---\n");
						}
						console.log("Process duration: " + process.uptime());
					});
				}
			});
		} else {
			// Save Progress - Users only
			if (resumeFromPage !== null) {
				var lastCompletedPage = resumeFromPage + (pageCompleted - 1);
				var file = './api-progress.json';
				var newProgress = apiProgress;
				newProgress[pathSearchUsers].only = lastCompletedPage;
				console.log("Users import progress: Page # " + lastCompletedPage);
				 
				jsonfile.writeFile(file, newProgress, {spaces: 4}, function (err) {
					if (err) {
						console.log(err);
						console.log("Last completed page progress for ["+cmdPath+"] = " + lastCompletedPage);
					} else {
						console.log("\n--- Job finished with no errors, please pull the config file from server ---\n");
					}
					console.log("Process duration: " + process.uptime());
				});
			}
		}
	} else if (cmdPath == pathSearchTags || cmdPath == pathSearchBadges) {
			// Save Progress - Tags or Badges
			if (resumeFromPage !== null) {
				var lastCompletedPage = resumeFromPage + (pageCompleted - 1);
				var file = './api-progress.json';
				var newProgress = apiProgress;
				newProgress[cmdPath] = lastCompletedPage;
				console.log(cmdPath + " import progress: Page # " + lastCompletedPage);
				 
				jsonfile.writeFile(file, newProgress, {spaces: 4}, function (err) {
					if (err) {
						console.log(err);
						console.log("Last completed page progress for ["+cmdPath+"] = " + lastCompletedPage);
					} else {
						console.log("\n--- Job finished with no errors, please pull the config file from server ---\n");
					}
					console.log("Process duration: " + process.uptime());
				});
			}
	} else {
		console.log("\n--- Job finished with no errors ---\n");
	}

}, (resumeFromPage ? resumeFromPage : null), getAllPages);

// db.select()

/**
 * Does a GET request to the StackExchange API. Function calls recursively
 * while there is more data to fetch (with a set delay)
 * 
 * @param  {string} path     	- questions, answers, users.. first arg on exec
 * @param  {string} tag      	- sql-server-2008, azure.. second arg on exec
 * @param  {array} 	saveToList  - array to store all data !! UNUSED AS OF 11/21
 * @param  {function} callback	- Callback function
 * @param  {int} 	pageNum  	- Defaults to 1
 * @return {}        		 [description]
 */
function doGetFromApi(path, tag, saveToList, callback, pageNum, doGetAll) {
 	var pageNum = pageNum || 1;
 	var siteName = config.project.site;
 	var delayPerSproc = 100;
 	var execDelay = returnDataLimit * delayPerSproc;
    var timer = 0;

 	timer = setTimeout(function() {
 		var reqParam = {
	 		url: config.api.stackExchange.url + path, 
	 		qs: {
	 			site: siteName,
	 			key: config.api.stackExchange.key,
	 			access_token: config.api.stackExchange.accessToken,
	 			tagged: tag,
	 			// Returns max 100 items per call, need to increment page and re-query if has_more
	 			pagesize: returnDataLimit,
	 			page: pageNum
	 		},
	 		headers: {
	 			'access_token': config.api.stackExchange.accessToken
	 		},
	 		gzip: true
	 	};
	 	// Allow certain paths to specify "inname"
	 	if (tag && (path.indexOf("tag") >= 0 || path.indexOf("badge") >= 0)) {
	 		reqParam.qs.inname = tag;
	 	}
	 	// Sort by creation date for: 
	 	// Users (not user-badges)
	 	// Questions
	 	if ((path.indexOf("users") >= 0 && path.indexOf("badge") < 0) 
	 		|| path.indexOf("questions") >= 0) {

	 		reqParam.qs.sort = "creation";
	 		reqParam.qs.order = "asc";
	 	}
 		request.get(reqParam, function(err, response, body) {
	 		if (err) {
	 			return callback(err);
	 		}
	 		var body = JSON.parse(body);

	 		if (parseInt(response.statusCode) != 200) {
	 			return callback("Error: " + body.error_name + " | Message: " + body.error_message);
	 		}
	 		var items = body.items;
	 		console.log("Call successful, item count: " + items.length + " | Page # " + pageNum);
	 		console.log("\n");

	 		if (path == "users" && items.length == 0) {
	 			return callback("No items found.. Aborting process..");
	 		}

			// Save items with only the ID param into array for any follow-up processing
			i = items.length;
			if (i > 0) {
				while(i--) {
					var toSave = {};
					var idKey = null;
					var idValue = null;
					for (var key in items[i]) {
						if (key.indexOf("_id") >= 0) {
							idKey = key;
							toSave[idKey] = items[i][idKey];
						}
					}
					saveToList.push(toSave);
				}
			}

	 		// Loop through JSON Data
	 		var tempList = readAndMap(path, items, tempList);
	 		
			// Execute SPROC to save
			// console.log("Sproc Params built: " + JSON.stringify(sprocParams));
			var pathReference = path;
			if (path.indexOf("user") >= 0 && path.indexOf("badge") >= 0) {
				pathReference = "user_badge";
			} else if (path.indexOf("badge") >= 0) {
				pathReference = "badges";
			} else if (path.indexOf("user") >= 0) {
				pathReference = "users";
			}
			else if (path.indexOf("answers") >= 0 && path.indexOf("questions") >= 0) {
				pathReference = "answers";
			} else if (path.indexOf("comments") >= 0) {
				pathReference = "comments";
			} else if (path.indexOf("questions") >= 0) {
				pathReference = "questions";
			}
			var sprocName = config.db.sqlSprocMap[pathReference];
			saveItemsToDb(sprocName, tempList, delayPerSproc, function(err) {
				if (err) {
					return callback(err);
				}

		 		// Recursion if there's more data
		 		// doGetAll = Get all pages, no stopping till then
		 		// 2nd Cond = Get 2 pages at a time, use with PM2 Cron to auto restart
		 		if ((doGetAll || pageNum < (resumeFromPage + pagePerLoad - 1)) && body.has_more) {
		 			pageNum += 1;
		 			timer = setTimeout(
		 				doGetFromApi(path, tag, saveToList, callback, pageNum, doGetAll),
	 					execDelay
	 				);
		 		} else {
		 			console.log("All data extracted for path: " + path);
		 			console.log("Remaining quota: " + body.quota_remaining);
		 			// Clear timeout and return
		 			clearTimeout(timer);
		 			return callback(false);
		 		}
			});
	 	});
 	}, 0);
}

/**
 * Gets data associated with the specified ID in an array of JSON items
 * e.g. Get Answers for every Question, Badges for every User
 * @param  {[type]}   dataToSearch      [Pass in an array of JSON items returned from the previous search]
 * @param  {[type]}   path 				[]
 * @param  {[type]}   referenceIdString [The ID to look for in each item (e.g. question_id, user_id)]
 * @param  {[type]}   trailPath         [The trailing path for the HTTP Post (e.g. api/users/12345/badges)]
 * @param  {[type]}   saveToList        [Pass in array to save in]
 * @param  {Function} callback          [Callback funtion]
 */
function getAssociatedData(dataToSearch, path, referenceIdString, trailPath, saveToList, callback) {
	var i = 0;
	var listLength = dataToSearch.length > returnDataLimit ? returnDataLimit : dataToSearch.length;
	// Recursive loop
	function run(i) {
		var pullLimit = (dataToSearch.length - i) > returnDataLimit ? returnDataLimit : (dataToSearch.length - i);
		var idArray = [];
		console.log("starting from index " + i);
		// Find applicable id string if multiple is given
		for (var k = i; k < (i + pullLimit); k++) {
			var referenceId = referenceIdString;
			if (referenceIdString instanceof Array) {
				for (var j = 0; j < referenceIdString.length; j++) {
					if (referenceIdString[j] in dataToSearch[k]) {
						referenceId = referenceIdString[j];
						break;
					}
				}
			}
			idArray.push(dataToSearch[k][referenceId]);
		}
		var idList = idArray.join(";");

		var getPath = path + "/" + idList + "/" + trailPath;
		console.log(getPath);
		doGetFromApi(getPath, "", saveToList, function(err) {
			if (err) {
				return callback(err);
			}
			// Increment
			i += idArray.length;
			// Always return last
			if (i == dataToSearch.length) {
				return callback(false);
			} else {
				// Continue with next
				run(i);
			}
		}, null, true);
	}
	run(i);
}

/**
 * Reads the "items" returned from the API and take action based on the "path"
 * specified (e.g. questions, answers).
 * Maps the item parameters to DB Table Column names.
 * 
 * @param  {string} path       	API path
 * @param  {array} items      	Array of JSON data returned from API
 * 
 * @return {array}            Returns array of items ready to execute SPROC
 */
function readAndMap(path, items) {
	var resultLimit = items.length;
	var saveToTemp = [];

	if (path == pathSiteInfo) {

		var paramsMap = config.api.stackExchange.itemsParameterMap.info;
		console.log("Site: " + siteName);

		var item = items[0];
		var tempStore = {};
		for (var key in paramsMap) {
			tempStore[key] = value;
			console.log(paramsMap[key]+": " + item[key]);
		}
		saveToList.push(tempStore);
		console.log("\n");

	} else {

		var map = config.db.sqlColumnsMap;

		if (path.indexOf("comment") >= 0) {
			var paramsMap = map.comment;

		} else if (path.indexOf("answer") >= 0) {
			var paramsMap = {};

			var json1 = map.post;
			var json2 = map.answer;
			for (var key in json1) paramsMap[key] = json1[key];
			for (var key in json2) paramsMap[key] = json2[key];

		} else if (path.indexOf("question") >= 0) {
			var paramsMap = {};

			var json1 = map.post;
			var json2 = map.question;
			for (var key in json1) paramsMap[key] = json1[key];
			for (var key in json2) paramsMap[key] = json2[key];

		} else if (path.indexOf("badge") >= 0 &&path.indexOf("tag") >= 0) {
			var paramsMap = map.badge;
		} else if (path.indexOf("tag") >= 0) {
			var paramsMap = map.tag;

		} else if (path.indexOf("user") >= 0 && path.indexOf("badge") >= 0) {
			var paramsMap = map.user_badge;
		} else if (path.indexOf("badge") >= 0) {
			var paramsMap = map.badge;
		} else if (path.indexOf("user") >= 0) {
			var paramsMap = map.user;
		}

		// For each result...
		for (var i = 0; i < resultLimit; i++) {
			var item = items[i];
			var sprocParams = {
				"in": [], "out": []
			};
			// Match each JSON param with our key => SqlTableColumn map
			for (var key in paramsMap) {
				var dbColName = paramsMap[key];
				var value = item[key];
				// If the value is nested, find inside
				if (typeof dbColName === 'object') {
					for (var subKey in dbColName) {
						dbColName = dbColName[subKey];
						value = item[key][subKey];
						break;
					}
				}
				// Set null if value isn't there
				if (typeof value === 'undefined') {
					value = null;
				}
				// Decode special entities (e.g. &quot;) into characters ("@!-&)
				if (dbColName === 'Title' || dbColName === 'DisplayName') {
					value = entities.decode(value);
				}
				// Convert boolean to BIT
				if (typeof value === 'boolean') {
					value = boolToBit(value);
				}
				// Convert array to comma-delim string
				else if (value instanceof Array) {
					value = value.join(",");
				}
				sprocParams.in.push({
					"key": dbColName,
					"value": value
				});
			}
			saveToTemp.push(sprocParams);
		}
	}
	return saveToTemp;
}

/**
 * Loops through list (recursive with delay) and calls SPROC for each item
 * 
 * @param  {[type]}   sprocName [description]
 * @param  {[type]}   itemList  [description]
 * @param  {[type]}   delay     [description]
 * @param  {Function} callback  [description]
 * @return {[type]}             [description]
 */
function saveItemsToDb(sprocName, itemList, delay, callback) {
	var timer = 0;
	var i = 0;
	var limit = itemList.length - 1;

	if (itemList.length === 0) {
		return callback(false);
	}

	function run(i) {
		timer = setTimeout(function() {
			var sprocParams = itemList[i];
			db.sproc(sprocName, sprocParams, function(err) {
				if (err) {
					clearTimeout(timer);
					return callback(err);
				}
				// Always return last
				if (i == limit) {
					clearTimeout(timer);
					console.log("All items in batch saved successfully. Execution count: " + (limit + 1));
					return callback(false);
				} else {
					// Continue with next
					i++;
					run(i);
				}
			});
		}, delay);
	}
	run(i);
}

/**
 * Supporting functions
 */
function boolToBit(bool) {
	return (bool === true ? 1 : 0);
}