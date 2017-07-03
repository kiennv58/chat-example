require('dotenv').config();
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var xhub       = require('express-x-hub');
var bodyParser = require('body-parser');
const request = require('promise');

// routes 
// ------------------------------------------------------------------------------------------------------------
var fbRoutes                  = require('./src/routes/fb');

const APP_KEY                      = process.env.APP_KEY;
const APP_SECRET                   = process.env.APP_SECRET;
const ACCESS_TOKEN                 = process.env.ACCESS_TOKEN;
const PORT                         = process.env.PORT;

var FB = require('fb');
FB.options({
    version:   'v2.7',
    appId:     APP_KEY,
    appSecret: APP_SECRET
});

// Mysql configuration
// --------------------------------------------------------------------------------------------------------------
var MYSQL;
function handleMySqlDisconnect() {
    MYSQL = mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PWD,
        database: process.env.MYSQL_DB
    });

    MYSQL.connect(function (err) {
        if (err) {
            console.log('error when connecting to mysql:', err);
            setTimeout(handleMySqlDisconnect, 2000);
        }
    });

    MYSQL.on('error', function (err) {
        console.log('mysql error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleMySqlDisconnect();
        } else {
            throw err;
        }
    });
}
handleMySqlDisconnect();

//--------------------------------------------------------------------

let domain_name = null;
io.sockets.on('connection', function (socket) {
    socket.on('merchant', function(message){
        fbRoutes.setSocket(socket, message);
        domain_name = message;
        console.log(message);
        var dataLog = {
            time : new Date(),
            domain_name: domain_name,
            count: 1
        };
        // fs.appendFile('count-user.txt', JSON.stringify(dataLog) + "\n" , 'utf8');
    });
    socket.on('disconnect', function () {
        var dataLog = {
            time : new Date(),
            domain_name: domain_name,
            count: -1
        };
        // fs.appendFile('count-user.txt', JSON.stringify(dataLog) + "\n" , 'utf8');
    });
});

app.set('port', (PORT || 3000));
app.use(xhub({ algorithm: 'sha1', secret: APP_SECRET }));
app.use(bodyParser.json());
// app.use(express.static(__dirname + '/public'));

// Begin routes
// -----------------------------------------------------------------------------------------------------------------------------
app.route('/fbwh')
    .get(fbRoutes.get)
    .post(fbRoutes.post);

// app.use('/statistic-total-users', statisticTotalUsersRouter);
// Server listening
// ------------------------------------------------------------------------------------------------------------------------------
http.listen(PORT, function () {
    console.log('Rapian instant message running on port ' + PORT);
});

// app.get('/', function(req, res){
//   res.sendFile(__dirname + '/index.html');
// });

// http.listen(process.env.PORT || 3000);

// io.on('connection', function(socket){
  
//   socket.on('chat message', function(msg){
//      io.emit('chat message', msg);
//    });
//   socket.broadcast.emit('hi');
// });

// io.emit('some event', { for: 'everyone' });

// http.listen(process.env.PORT || 3000);