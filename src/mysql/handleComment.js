var Promise = require('promise')
var mysql   = require('mysql');
var FB      = require('fb');

var helper    = require('../helpers/function');

var MYSQL = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PWD,
  database : process.env.MYSQL_DB
});

const APP_KEY                      = process.env.APP_KEY;
const APP_SECRET                   = process.env.APP_SECRET;

FB.options({
    version: 'v2.7',
    appId: APP_KEY,
    appSecret: APP_SECRET
});
/**
 * @param data json
 * return null
 */
function handleHideComment(data){
	FB.setAccessToken(data.access_token);
    // check comment can hide
    FB.api('/' + data.comment_id + '?fields=can_hide', function(res) {
        if (!res || res.error) {
            console.log(!res ? 'error occurred' : res.error);
            return;
        }
        // hide comment
        if (res.can_hide){
            FB.api('/' + data.comment_id, 'post', { is_hidden: true }, function(res) {
                if (!res || res.error) {
                    console.log(!res ? 'error occurred' : res.error);
                    return;
                }
            });
        }
    });
}
/**
 * @param data json
 * return null
 */
function handleLikeComment(data) {
    FB.setAccessToken(data.access_token);
    FB.api('/' + data.comment_id + '/likes', 'post', {}, function(res) {
        if (!res || res.error) {
            console.log(!res ? 'error occurred' : res.error);
            return;
        }
    });
}
/**
 * @param data json
 * return null
 */
function handleReplyComment(data) {
    FB.setAccessToken(data.access_token);
    FB.api('/' + data.comment_id + '/comments', 'post', { message: data.message }, function(res) {
        if (!res || res.error) {
            console.log(!res ? 'error occurred' : res.error);
            return;
        }
    });
}

/**
 * @param commentIdGenerate string
 * @param pageId integer
 * @return Promise
 */
function checkCommentConversationIsExist(commentIdGenerate, pageId){
	var comment = new Promise(function (resolve, reject) {
        
        var query = "select * from facebook_page_comments where fpc_id_comment_generate = \'" + commentIdGenerate + "\' and fpc_facebook_page_connect_id = " + pageId + " group by fpc_id_comment_generate order by fpc_created_time desc";
        MYSQL.query(query, function(err, rows, fields) {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    return comment;
}

/**
 * @param senderId string
 * @param postId string
 * @param dataUpdate json
 * @return Promise
 */
function updateCommentConversation(senderId, postId, dataUpdate){
    var comment = new Promise(function (resolve, reject) {
        var query = "UPDATE facebook_page_comments SET ? WHERE fpc_post_id = \'"  + postId + "\' AND fpc_sender_id = \'" + senderId + "\'";
	
        MYSQL.query(query, dataUpdate, function(err, results) {
            if (err) reject(err);
            else resolve(results.affectedRows);
        });
    });
    return comment;
}

/**
 * @param data json
 * @return Promise
 */
function createCommentConversation(data){
    var comment = new Promise(function (resolve, reject) {
		
		var query = 'INSERT INTO facebook_page_comments SET ?';
		MYSQL.query(query, data, function(err, result){
			if (err) reject(err);
			else resolve(result.insertId);
		});
	});
	return comment;
}
/**
 * @param senderId string
 * @param postId string
 * @param facId integer
 * @return Promise
 */
function checkCommetExistUserBySender(senderId, postId, facId){
    var comment = new Promise(function (resolve, reject) {
        var query = "select * from facebook_page_comments inner join users on fpc_user_id = id where user_status = 1 and fpc_facebook_page_connect_id = " + facId + " and fpc_sender_id = \'" + senderId + "\' and fpc_user_id is not null and fpc_post_id = \'" + postId + "\'";
        MYSQL.query(query, function(err, rows, fields) {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    return comment;
}
/**
 * @param facId integer
 * @param userId integer
 * @returns Promise
 */
function countUserHasCommentConversationByPage(facId, userId){
    var conversation = new Promise(function (resolve, reject) {
        var query = "select count(fpc_user_id) as total_conversation from facebook_page_comments inner join users on fpc_user_id = id where user_status = 1 and fpc_facebook_page_connect_id = " + facId + " and fpc_user_id = " + userId + " and fpc_time_check_created > " + Math.round(helper.todayMidNight() / 1000);
        
        MYSQL.query(query, function(err, rows, fields) {
            if (err) reject(err);
            else resolve(rows);
        });   
    });
    return conversation;
}

/**
 * @param userId integer
 * @param facId integer
 * @param senderId string
 * @param postId string
 * @return null
 */
function setUserToConversation(userId, facId, senderId, postId){
    var query = "update facebook_page_comments set fpc_user_id = " + userId + " where fpc_facebook_page_connect_id = " + facId + " and fpc_sender_id = \'" + senderId + "\' and fpc_post_id = \'" + postId + "\'";
    
    MYSQL.query(query, function(err, result) {
        if (err){console.log(err); return};
    });  
}

module.exports = {
	handleHideComment,
    handleLikeComment,
    handleReplyComment,
	checkCommentConversationIsExist,
    updateCommentConversation,
    createCommentConversation,
    checkCommetExistUserBySender,
    countUserHasCommentConversationByPage,
    setUserToConversation,
}