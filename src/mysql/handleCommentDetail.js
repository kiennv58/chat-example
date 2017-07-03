var Promise    = require('promise')
var mysql      = require('mysql');

var MYSQL = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PWD,
  database : process.env.MYSQL_DB
});
/**
 * @param commentId string
 * @return null
 */
function updateHideComment(commentId){
    
    var query = 'UPDATE facebook_page_comments_detail SET fpd_hide_status = 1 WHERE fpd_comment_id = \'' + commentId + "\'";
    MYSQL.query(query);
}
/**
 * @param commentId string
 * @return null
 */
function updateUnhideComment(commentId){
    
    var query = 'UPDATE facebook_page_comments_detail SET fpd_hide_status = 0 WHERE fpd_comment_id = \'' + commentId + "\'";
    MYSQL.query(query);
}
/**
 * @param commentId string
 * @return null
 */
function updateDeleteComment(commentId){
    
    var query = 'UPDATE facebook_page_comments_detail SET fpd_delete_status = 1 WHERE fpd_comment_id = \'' + commentId + "\'";
    MYSQL.query(query);
}
/**
 * @param commentId string
 * @return Promise
 */
function getByCommentId(commentId){
    var commentDetail = new Promise(function (resolve, reject) {
        var query = 'SELECT * FROM facebook_page_comments_detail WHERE fpd_comment_id = \'' + commentId + '\'';
        MYSQL.query(query, function(err, rows, fields) {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    return commentDetail;
}
/**
 * @param data json
 * @return Promise
 */
function createCommentDetail(data){
    var commentDetail = new Promise(function (resolve, reject) {
		
		var query = 'INSERT INTO facebook_page_comments_detail SET ?';
		MYSQL.query(query, data, function(err, result){
			if (err) reject(err);
			else resolve(result.insertId);
		});
	});
	return commentDetail;
}
/**
 * @param commentId string
 * @param time integer
 * @return null
 */
function updateCreateTimeCommentDetail(commentId, time){
    var query = "update facebook_page_comments_detail set fpd_created_time = " + time + " where fpd_comment_id = \'" + commentId + "\'";
    
    MYSQL.query(query, function(err, rows, fields) {
        if (err) {console.log(err); return;};
    });
}

module.exports = {
	updateHideComment,
	updateUnhideComment,
	updateDeleteComment,
	getByCommentId,
    createCommentDetail,
    updateCreateTimeCommentDetail,
}