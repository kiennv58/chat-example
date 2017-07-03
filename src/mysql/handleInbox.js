var Promise    = require('promise')
var mysql      = require('mysql');

var helper    = require('../helpers/function');

var MYSQL = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PWD,
  database : process.env.MYSQL_DB
});
/**
 * @param conversationId string
 * @return Promise
 */
function getByConversationId(conversationId){
  var InboxDetail = new Promise(function (resolve, reject) {
        
        var query = 'SELECT * FROM facebook_page_inbox WHERE fpi_facebook_conversation_id = \'' + conversationId + '\'';
        MYSQL.query(query, function(err, rows, fields) {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    return InboxDetail;
}
/**
 * @param data json
 * @return Promise
 */
function createInbox(data){
	var inbox = new Promise(function (resolve, reject) {
		var query = 'INSERT INTO facebook_page_inbox SET ?';
		MYSQL.query(query, data, function(err, result){
			if (err) reject(err);
			else resolve(result.insertId);
		});
	});
	return inbox;
}
/**
 * @param data json
 * @param conversationId integer
 * @returns null
 */
function updateInbox(data, conversationId){
	var inbox = new Promise(function (resolve, reject) {
		var query = "UPDATE facebook_page_inbox SET ? WHERE fpi_facebook_conversation_id = \'" + conversationId + "\'";
		MYSQL.query(query, data, function(err, results) {
			if (err) reject(err);
			else resolve(results.affectedRows);
		});
	});
	
	return inbox;
}

/**
 * @param conversationId integer
 * @param facId integer
 * @return Promise
 */
function checkConversationExistUser(conversationId, facId){
	var inbox = new Promise(function (resolve, reject) {
		var query = "select * from facebook_page_inbox inner join users on fpi_user_id = id where user_status = 1 and fpi_facebook_conversation_id = \'" + conversationId + "\' and fpi_facebook_page_connect_id = " + facId + " and fpi_user_id is not null";
		
		MYSQL.query(query, function(err, result){
			if (err) reject(err);
			else resolve(result);
		});
	});
	return inbox;
}
/**
 * @param userId integer
 * @param facId integer
 * @return Promise
 */
function countUserHasConversationByPage(userId, facId){
	var conversation = new Promise(function(resolve, reject){
		var midNight = Math.round(helper.todayMidNight() / 1000);
		var query = "select count(fpi_user_id) as total_conversation from facebook_page_inbox inner join users on fpi_user_id = id where user_status = 1 and fpi_facebook_page_connect_id = " + facId + " and fpi_user_id = " + userId + " and fpi_time_check_created > " + midNight;
		MYSQL.query(query, function(err, result){
			if (err) reject(err);
			else resolve(result);
		});
	});
	return conversation;
}

/**
 * @param userId integer
 * @param conversationId integer
 * @param facId integer 
 * @return null
 */
function setUserToConversation(userId, conversationId, facId){
	var query = "update facebook_page_inbox set fpi_user_id = " + userId + " where fpi_facebook_conversation_id = \'" + conversationId + "\' and fpi_facebook_page_connect_id = " + facId;
	
	MYSQL.query(query, function(err, result){
		if (err) {console.log(err); return};
	});
}

module.exports = {
	getByConversationId,
	createInbox,
	updateInbox,
	checkConversationExistUser,
	countUserHasConversationByPage,
	setUserToConversation,
}