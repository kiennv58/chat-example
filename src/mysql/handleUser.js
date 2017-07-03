var Promise    = require('promise')
var mysql      = require('mysql');

var MYSQL = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PWD,
  database : process.env.MYSQL_DB
});
/**
 * @param domId integer
 * @return Promise
 */
function getAllUsersDomain(domId){
    users = new Promise(function (resolve, reject) {
        var query = "SELECT id, email, phone, fullname, address, birthday, dus_owner AS isOwner, avatar, user_status, per_permission, IF ( fullname IS NULL, email, fullname ) AS fullname FROM users INNER JOIN domains_users ON id = dus_user_id INNER JOIN permissions ON id = per_user_id WHERE users.deleted_at IS NULL AND dus_domain_id = " + domId + " AND dus_owner = 0 AND user_status = 1 ORDER BY created_at DESC";
        
        MYSQL.query(query, function(err, result){
			if (err) reject(err);
			else resolve(result);
		});
    });
    return users;
}

/**
 * @param userId
 * @param domId
 * @return Promise
 */
function getUserPermission(userId, domId){
    var permissions = new Promise(function(resolve, reject){
        var query = "select per_permission from permissions where per_user_id = " + userId + " and per_merchant_id = " + domId;
        
        MYSQL.query(query, function(err, result){
			if (err) reject(err);
			else resolve(result);
		});
    });
    return permissions;
}

module.exports = {
    getAllUsersDomain,
    getUserPermission
}