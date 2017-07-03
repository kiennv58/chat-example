var Promise    = require('promise')
var mysql      = require('mysql');

var MYSQL = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PWD,
  database : process.env.MYSQL_DB
});
/**
 * @param fbPageId integer
 * @return Promise
 */
function getFacebookPageConnect (fbPageId) {
    var facebookPageConnect = new Promise(function (resolve, reject) {
        var query = 'SELECT facebook_page_connect.*,dom_id,dom_name,dom_shop_name,dom_shop_phone FROM facebook_page_connect INNER JOIN domains ON fac_domain_id = domains.dom_id WHERE fac_page_id = ' + fbPageId;
        MYSQL.query(query, function(err, rows, fields) {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    return facebookPageConnect;
}

module.exports = {
    getFacebookPageConnect,
}