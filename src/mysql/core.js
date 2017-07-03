var Promise    = require('promise')
var mysql      = require('mysql');

var MYSQL = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PWD,
  database : process.env.MYSQL_DB,
  port: process.env.MYSQL_PORT
});

//code here

module.exports = {
}