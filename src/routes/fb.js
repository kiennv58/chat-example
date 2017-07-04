require('dotenv').config();
// Constant list
// ----------------------------------------------------------------------------------------------------------------------
const WK_VERIFY_TOKEN              = process.env.WK_VERIFY_TOKEN;
const ACCESS_TOKEN              = process.env.ACCESS_TOKEN;
const PUBSUB_CHANNEL               = process.env.PUBSUB_CHANNEL;
const APP_KEY                      = process.env.APP_KEY;
const APP_SECRET                   = process.env.APP_SECRET;
// Dependency definition
// ------------------------------------------------------------------------------------------------------------------------
var Promise                   = require('promise');
var FB                        = require('fb');
var facebookConnectRepository = require('../mysql/handleFacebookPageconnect');
var commentRepository         = require('../mysql/handleComment');
var commentDetailRepository   = require('../mysql/handleCommentDetail');
var inboxRepository           = require('../mysql/handleInbox');
var userRepository            = require('../mysql/handleUser');
var helper                    = require('../helpers/function');
// Facebook configuration
// ------------------------------------------------------------------------------------------------------------------------
FB.options({
    version: 'v2.9'
});
// Redis pub/sub definition
// ------------------------------------------------------------------------------------------------------------------------

//socket io
let _socket = [];
function setSocket(socket, merchant){
    if(typeof _socket[merchant] === 'undefined'){
        _socket[merchant] = [];
    }
    _socket[merchant].push(socket);
}
/**
 * Get method for webhook
 */
function whGet(req, res) {
    if (
        req.param('hub.mode') == 'subscribe' &&
        req.param('hub.verify_token') == WK_VERIFY_TOKEN
    ) {
        res.status(200).send(req.param('hub.challenge'));
    } else {
        res.sendStatus(400);
    }
}

/**
 * Post method for webhook
 */
function whPost(req, res) {
    if (req.isXHub && req.isXHubValid()) {
        res.sendStatus(200);
        FB.setAccessToken(ACCESS_TOKEN);
        FB.api('280840585655132/feed', function (res) {
          if(!res || res.error) {
           console.log(!res ? 'error occurred' : res.error);
           return;
          }
          console.log(res);
        });    
    } else {
        res.status(401).send('Failed to verify!\n');
    }
}


module.exports = {
    get: whGet,
    post: whPost,
    setSocket
}
