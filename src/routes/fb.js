require('dotenv').config();
// Constant list
// ----------------------------------------------------------------------------------------------------------------------
const WK_VERIFY_TOKEN              = process.env.WK_VERIFY_TOKEN;
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
    version: 'v2.7',
    appId: APP_KEY,
    appSecret: APP_SECRET
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
        var fbResponseData = req.body;
        // Đọc dữ liệu response
        fbResponseData.entry.forEach(function (element) {
            var fbPageId = element.id;
            var dataFacebookPage = facebookConnectRepository.getFacebookPageConnect(fbPageId);
            dataFacebookPage.done(function (facebookPageConnect) {
                if(!facebookPageConnect.length){
                    return;
                }
                var currentTime = Math.round(new Date().getTime() / 1000);
                // kiểm tra fanpage hết hạn thì bỏ qua
                if (facebookPageConnect[0].expired_at < currentTime) {
                    return;
                }

                var pageAccessToken = facebookPageConnect[0].fac_page_access_token;

                switch (element.changes[0].field) {
                    case 'conversations':
                        var dataRealTime = Object.assign({}, { entry: [element] }, { type: 1 });
                        dataRealTime.dom_name     = facebookPageConnect[0].dom_name;
                        dataRealTime.dom_id       = facebookPageConnect[0].dom_id;
                        var conversationId = element.changes[0].value.thread_id;
                        //query facebook lấy dữ liệu inbox conversation
                        var responseInbox = new Promise(function (resolve, reject) {
                            FB.setAccessToken(pageAccessToken);
                            FB.api('/' + conversationId + '?fields=message_count,messages{shares,attachments,id,from,to,message,created_time}', function (res) {
                                if (!res || res.error) reject(res.error);
                                else resolve(res);
                            });
                        });

                        responseInbox.done(function (response) {
                            if (!(typeof response.messages === 'undefined') && (response.messages.data.length)) {
                                var dataFb = response.messages.data[0];
                                var dataStore = {
                                    fpi_facebook_page_connect_id: facebookPageConnect[0].fac_id,
                                    fpi_facebook_conversation_id: conversationId,
                                    fpi_sender_id: '',
                                    fpi_sender_name: '',
                                    fpi_snippet: '',
                                    fpi_created_time: currentTime,
                                    fpi_read: 0,
                                    fpi_unread_count: 1
                                };
                                if (dataFb.from.id != facebookPageConnect[0].fac_page_id) {
                                    dataStore.fpi_sender_id = dataFb.from.id;
                                    dataStore.fpi_sender_name = dataFb.from.name;
                                } else {
                                    dataStore.fpi_sender_id = dataFb.to.data[0].id;
                                    dataStore.fpi_sender_name = dataFb.to.data[0].name;
                                }
                                if (!(typeof dataFb.message === 'undefined')) {
                                    dataStore.fpi_snippet = dataFb.message.slice(0, 80);
                                    //detext phone email on message
                                    var detectedPhone = helper.detextPhone(dataFb.message),
                                        detectedEmail = helper.detextEmail(dataFb.message);
                                    if (detectedPhone.status) {
                                        dataStore.fpi_phone_include = 1;
                                        dataStore.fpi_list_phone_include = detectedPhone.phone;
                                    }
                                    if (detectedEmail.status) {
                                        dataStore.fpi_email_include = 1;
                                        dataStore.fpi_list_email_include = detectedEmail.email;
                                    }
                                }
                                if (!(typeof dataFb.created_time === 'undefined')) {
                                    timeFbRes = new Date(dataFb.created_time);
                                    dataStore.fpi_created_time = Math.round(timeFbRes.getTime() / 1000);
                                }
                                var dataUpdate = dataStore;
                                var dataConversation = inboxRepository.getByConversationId(conversationId);
                                dataConversation.done(function (dataConversation) {
                                    if (dataConversation.length) {
                                        dataUpdate.fpi_unread_count = dataConversation[0].fpi_unread_count + 1;
                                        //xử lý số điện thoại email
                                        if (!(typeof dataUpdate.fpi_phone_include === "undefined") && dataUpdate.fpi_phone_include == 1) {
                                            var oldListPhone = JSON.parse(dataConversation[0].fpi_list_phone_include),
                                                newListPhone = JSON.parse(dataUpdate.fpi_list_phone_include);
                                            if (!oldListPhone) {
                                                oldListPhone = [];
                                            }
                                            var listPhoneInclue = oldListPhone.concat(newListPhone).unique();
                                            dataUpdate.fpi_list_phone_include = JSON.stringify(listPhoneInclue);
                                        }
                                        if (!(typeof dataUpdate.fpi_email_include === "undefined") && dataUpdate.fpi_email_include == 1) {
                                            var oldListEmail = JSON.parse(dataConversation[0].fpi_list_email_include),
                                                newListEmail = JSON.parse(dataUpdate.fpi_list_email_include);
                                            if (!oldListEmail) {
                                                oldListEmail = [];
                                            }
                                            var listEmailInclue = oldListEmail.concat(newListEmail).unique();
                                            dataUpdate.fpi_list_email_include = JSON.stringify(listEmailInclue);
                                        }
                                        var updateInboxConversation = inboxRepository.updateInbox(dataUpdate, conversationId);
                                        updateInboxConversation.done(function (val) {
                                            if (val) {
                                                if(!(typeof _socket[facebookPageConnect[0].dom_name] === 'undefined')){
                                                     _socket[facebookPageConnect[0].dom_name].forEach(function(socket) {
                                                        socket.emit('conv-' + facebookPageConnect[0].dom_name, dataRealTime);
                                                    });
                                                }
                                            }
                                        });

                                    } else {
                                        dataStore.fpi_time_check_created = currentTime;
                                        var insertInbox = inboxRepository.createInbox(dataStore);
                                        insertInbox.done(function (val) {
                                            if (val) {
                                               if(!(typeof _socket[facebookPageConnect[0].dom_name] === 'undefined')){
                                                    _socket[facebookPageConnect[0].dom_name].forEach(function(socket) {
                                                        socket.emit('conv-' + facebookPageConnect[0].dom_name, dataRealTime);
                                                    });
                                                }
                                            }
                                        })
                                    }
                                    // Kiểm tra conversation đã có user quản lý chưa
                                    // Chưa có thì update
                                    // var inboxConversationHasUser = inboxRepository.checkConversationExistUser(conversationId, facebookPageConnect[0].fac_id);
                                    // inboxConversationHasUser.done(function (value) {
                                    //     if (!value.length) {
                                    //         var usersOfDomain = userRepository.getAllUsersDomain(facebookPageConnect[0].fac_domain_id);
                                    //         usersOfDomain.done(function (users) {
                                    //             var processUsers = new Promise(function (resolve, reject) {
                                    //                 var userHasPermission = [];
                                    //                 users.forEach(function (user, index) {
                                    //                     var userPermission = JSON.parse(user.per_permission);
                                    //                     if (!(typeof userPermission['rpage_inbox.manager'] === 'undefined') && userPermission['rpage_inbox.manager']) {
                                    //                         userHasPermission.push(user.id);
                                    //                     }
                                    //                 });
                                    //                 resolve(userHasPermission);
                                    //             });
                                    //             processUsers.done(function (userArr) {
                                    //                 var conversationByUser = [];
                                    //                 var processConversations = new Promise(function (resolve, reject) {
                                    //                     userArr.forEach(function (u, i) {
                                    //                         var totalConversation = inboxRepository.countUserHasConversationByPage(u, facebookPageConnect[0].fac_id);
                                    //                         totalConversation.done(function (totalConversation) {
                                    //                             conversationByUser.push(totalConversation[0].total_conversation);
                                    //                             if (i == userArr.length - 1) {
                                    //                                 resolve(conversationByUser);
                                    //                             }
                                    //                         });
                                    //                     });
                                    //                 })
                                    //                 processConversations.done(function (userConversation) {
                                    //                     var userHasMinConversation = userArr[userConversation.indexOf(Math.min(...userConversation))];
                                    //                     inboxRepository.setUserToConversation(userHasMinConversation, conversationId, facebookPageConnect[0].fac_id);
                                    //                 });
                                    //             });
                                    //         });
                                    //     }
                                    // });
                                });
                            }
                        }, function(reject){
                            console.log(reject);
                            return;
                        });

                        break;

                    case 'feed':
                        var dataRealTime = Object.assign({}, { entry: [element] }, { type: 2 });
                        dataRealTime.dom_name = facebookPageConnect[0].dom_name;
                        dataRealTime.dom_id = facebookPageConnect[0].dom_id;
                        var item = element.changes[0].value.item,
                            verb = element.changes[0].value.verb,
                            commentId = element.changes[0].value.comment_id,
                            userMessages = "";
                        if (item == "like") {
                            return;
                        }

                        if (item == "comment" && verb == "add" && commentId) {
                            if (!(typeof element.changes[0].value.message === "undefined")) {
                                userMessages = element.changes[0].value.message;
                                //auto create order
                                if(facebookPageConnect[0].fac_config_auto_create_order && helper.detextAutoOrder(userMessages)){
                                    var dataDomain = {
                                        fac_page_id: facebookPageConnect[0].fac_page_id,
                                        fac_id: facebookPageConnect[0].fac_id,
                                        dom_shop_name: facebookPageConnect[0].dom_shop_name,
                                        dom_shop_phone: facebookPageConnect[0].dom_shop_phone,
                                        fac_page_access_token: facebookPageConnect[0].fac_page_access_token
                                    };
                                    var dataAutoCreateOrder = Object.assign({}, dataRealTime, {domain: dataDomain});
                                    pub.publish(PUBSUB_CHANNEL, JSON.stringify(dataAutoCreateOrder));
                                }
                            }
                            // ẩn comment
                            // ẩn tất cả comment
                            if (facebookPageConnect[0].fac_config_auto_hide_comment) {
                                if (facebookPageConnect[0].fac_config_hide_comment_all) {
                                    commentRepository.handleHideComment({ comment_id: commentId, access_token: pageAccessToken });
                                } else {
                                    // ẩn comment chứa số điện thoại
                                    if (facebookPageConnect[0].fac_config_hide_comment_phone && helper.detextPhone(userMessages).status) {
                                        commentRepository.handleHideComment({ comment_id: commentId, access_token: pageAccessToken });
                                    }
                                    // ẩn comment chứa email
                                    if (facebookPageConnect[0].fac_config_hide_comment_email && helper.detextEmail(userMessages).status) {
                                        commentRepository.handleHideComment({ comment_id: commentId, access_token: pageAccessToken });
                                    }
                                    // ẩn comment chứa các từ tiêu cực
                                    if (facebookPageConnect[0].fac_auto_hide_keyword) {
                                        var keywordStr = facebookPageConnect[0].fac_list_keyword_hide || "";
                                        var listKeyWork = keywordStr.split(",");
                                        if (listKeyWork.length) {
                                            listKeyWork.forEach(function (keyWork) {
                                                if (!(userMessages.search(keyWork.trim()) === -1)) {
                                                    commentRepository.handleHideComment({ comment_id: commentId, access_token: pageAccessToken });
                                                    return;
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                            //auto reply
                            if (facebookPageConnect[0].fac_config_auto_reply_comment) {
                                var ruleAutoReply = JSON.parse(facebookPageConnect[0].fac_config_day_auto_reply),
                                    today = new Date(),
                                    timeForm = new Date(today.getFullYear(), today.getMonth(), today.getDate(), ruleAutoReply.hour_from, ruleAutoReply.minitue_from, 0),
                                    timeTo = new Date(today.getFullYear(), today.getMonth(), today.getDate(), ruleAutoReply.hour_to, ruleAutoReply.minitue_to, 0);
                                if (today.getTime() > timeForm.getTime() && today.getTime() < timeTo.getTime()) {
                                    pub.get('reply_' + commentId, function (err, reply) {
                                        if (typeof reply === 'undefined' || reply == null || reply == '') {
                                            commentRepository.handleReplyComment({ comment_id: commentId, access_token: pageAccessToken, message: facebookPageConnect[0].fac_config_description_auto_reply });
                                            //lưu comment id để xử lý
                                            pub.set('reply_' + commentId, 1);
                                            //tự động xóa sau 12h
                                            pub.expire('reply_' + commentId, 43200);
                                        }
                                    });
                                }
                            }
                            // auto like comment
                            if (facebookPageConnect[0].fac_auto_like_comment) {
                                commentRepository.handleLikeComment({ access_token: pageAccessToken, comment_id: commentId });
                            }

                            // lưu thông tin vào database
                            var postId = element.changes[0].value.post_id;
                            var responsePost = new Promise(function (resolve, reject) {
                                FB.setAccessToken(pageAccessToken);
                                FB.api('/' + postId + '?fields=id,message,link,created_time,attachments,permalink_url,likes.summary(true)', function (res) {
                                    if (!res || res.error) reject(res.error);
                                    else resolve(res);
                                });
                            });
                            responsePost.done(function (postDetail) {
                                var postContent = "",
                                    postUpdateTime = currentTime,
                                    postLink = postDetail.permalink_url,
                                    postLinkImage = '';
                                if (!(typeof postDetail.message === 'undefined')) {
                                    postContent = postDetail.message;
                                }
                                if (!(typeof postDetail.attachments === 'undefined')) {
                                    if (!(typeof postDetail.attachments.data[0].media === 'undefined') && !(postDetail.attachments.data[0].media.image === 'undefined') && !(postDetail.attachments.data[0].media.image)) {
                                        postLinkImage = postDetail.attachments.data[0].media.image.src;
                                    }
                                    if (postContent == "" && !(typeof postDetail.attachments.data[0].title === 'undefined')) {
                                        postContent = postDetail.attachments.data[0].title;
                                    }
                                }
                                var dataStoreComment = {
                                    fpc_facebook_page_connect_id: facebookPageConnect[0].fac_id,
                                    fpc_comment_id: commentId,
                                    fpc_post_id: postId,
                                    fpc_post_content: postContent,
                                    fpc_post_updated_time: postUpdateTime,
                                    fpc_post_link: postLink,
                                    fpc_post_link_image: postLinkImage,
                                    fpc_read: 0,
                                    fpc_unread_count: 1,
                                    fpc_sender_id: '',
                                    fpc_sender_name: '',
                                    fpc_message: '',
                                    fpc_created_time: currentTime,
                                    fpc_time_check_created: currentTime,
                                    fpc_url_avatar: ''
                                }
                                if (!(typeof element.changes[0].value.sender_id === 'undefined')) {
                                    dataStoreComment.fpc_sender_id = element.changes[0].value.sender_id;
                                }
                                if (!(typeof element.changes[0].value.sender_name === 'undefined')) {
                                    dataStoreComment.fpc_sender_name = element.changes[0].value.sender_name;
                                }
                                if (!(typeof element.changes[0].value.message === 'undefined')) {
                                    dataStoreComment.fpc_message = element.changes[0].value.message;
                                }
                                if (!(typeof element.changes[0].value.created_time === 'undefined')) {
                                    dataStoreComment.fpc_created_time = element.changes[0].value.created_time;
                                    dataStoreComment.fpc_time_check_created = element.changes[0].value.created_time;
                                }
                                dataStoreComment.fpc_id_comment_generate = postId + '_' + dataStoreComment.fpc_sender_id;
                                dataStoreComment.fpc_url_avatar = '//graph.facebook.com/' + dataStoreComment.fpc_sender_id + '/picture?width=80&height=80';

                                var detectedPhone = helper.detextPhone(userMessages),
                                    detectedEmail = helper.detextEmail(userMessages);
                                if (detectedPhone.status) {
                                    dataStoreComment.fpc_phone_include = 1;
                                    dataStoreComment.fpc_include_phone_list = detectedPhone.phone;
                                }
                                if (detectedEmail.status) {
                                    dataStoreComment.fpc_email_include = 1;
                                    dataStoreComment.fpc_include_email_list = detectedEmail.email;
                                }
                                if (element.changes[0].value.parent_id != postId && !(typeof element.changes[0].value.sender_id === 'undefined') && element.changes[0].value.sender_id != facebookPageConnect[0].fac_page_id) {
                                    var parentCommentConversation = commentDetailRepository.getByCommentId(element.changes[0].value.parent_id);
                                    parentCommentConversation.done(function (dataParentComment) {
                                        if (dataParentComment.length) {
                                            var dataUpdateCommentConversation = {
                                                fpc_message: dataStoreComment.fpc_message,
                                                fpc_read: 0,
                                                fpc_created_time: dataStoreComment.fpc_created_time,
                                                fpc_post_content: dataStoreComment.fpc_post_content,
                                                fpc_post_updated_time: dataStoreComment.fpc_post_updated_time,
                                                fpc_post_link: dataStoreComment.fpc_post_link,
                                                fpc_post_link_image: dataStoreComment.fpc_post_link_image,
                                                fpc_last_sender_name: element.changes[0].value.sender_name,
                                                fpc_last_sender_id: element.changes[0].value.sender_id,
                                                fpc_comment_id: commentId,
                                                fpc_reply: 0
                                            }
                                            if (!(typeof dataStoreComment.fpc_phone_include === 'undefined')) {
                                                dataUpdateCommentConversation.fpc_phone_include = dataStoreComment.fpc_phone_include;
                                            }
                                            if (!(typeof dataStoreComment.fpc_email_include === 'undefined')) {
                                                dataUpdateCommentConversation.fpc_email_include = dataStoreComment.fpc_email_include;
                                            }
                                            var checkCommentIsExist = commentRepository.checkCommentConversationIsExist(dataParentComment[0].fpd_post_id + '_' + dataParentComment[0].fpd_sender_id, facebookPageConnect[0].fac_id);
                                            checkCommentIsExist.done(function (commentExist) {
                                                if (commentExist.length) {
                                                    dataUpdateCommentConversation.fpc_unread_count = commentExist[0].fpc_unread_count + 1;
                                                    //xử lý số điện thoại email
                                                    if (detectedPhone.status) {
                                                        if(!commentExist[0].fpc_include_phone_list){
                                                            commentExist[0].fpc_include_phone_list = "[]";
                                                        }
                                                        var oldListPhone = JSON.parse(commentExist[0].fpc_include_phone_list),
                                                            newListPhone = JSON.parse(dataStoreComment.fpc_include_phone_list);
                                                        if (!oldListPhone) {
                                                            oldListPhone = [];
                                                        }
                                                        var listPhoneInclue = oldListPhone.concat(newListPhone).unique();
                                                        dataUpdateCommentConversation.fpc_include_phone_list = JSON.stringify(listPhoneInclue);
                                                    }
                                                    if (detectedEmail.status) {
                                                        if(!commentExist[0].fpc_include_email_list){
                                                            commentExist[0].fpc_include_email_list = "[]";
                                                        }
                                                        var oldListEmail = JSON.parse(commentExist[0].fpc_include_email_list),
                                                            newListEmail = JSON.parse(dataStoreComment.fpc_include_email_list);
                                                        if (!oldListEmail) {
                                                            oldListEmail = [];
                                                        }
                                                        var listEmailInclue = oldListEmail.concat(newListEmail).unique();
                                                        dataUpdateCommentConversation.fpc_include_email_list = JSON.stringify(listEmailInclue);
                                                    }
                                                    if (dataParentComment[0].fpd_sender_id != element.changes[0].value.sender_id && element.changes[0].value.sender_id != facebookPageConnect[0].fac_page_id) {
                                                        dataUpdateCommentConversation.fpc_has_mutil_sender = 1;
                                                    }
                                                    var checkCommentDetailIsExist = commentDetailRepository.getByCommentId(commentId);
                                                    checkCommentDetailIsExist.done(function (commentDetailExist) {
                                                        if (!commentDetailExist.length) {
                                                            var updateCommentConv = commentRepository.updateCommentConversation(dataParentComment[0].fpd_sender_id, postId, dataUpdateCommentConversation);
                                                            updateCommentConv.done(function (val) {
                                                                if (val) {
                                                                    if(!(typeof _socket[facebookPageConnect[0].dom_name] === 'undefined')){
                                                                        _socket[facebookPageConnect[0].dom_name].forEach(function(socket) {
                                                                            socket.emit('feed-' + facebookPageConnect[0].dom_name, dataRealTime);
                                                                        });
                                                                    }
                                                                }
                                                            });
                                                            // comment detail
                                                            var dataStoreCommentDetail = {
                                                                fpd_comment_id: commentId,
                                                                fpd_post_id: postId,
                                                                fpd_sender_id: '',
                                                                fpd_sender_name: '',
                                                                fpd_message: '',
                                                                fpd_created_time: currentTime,
                                                                fpd_read: 0,
                                                                fpd_facebook_page_connments_id: commentExist[0].fpc_id
                                                            };
                                                            if (!(typeof element.changes[0].value.sender_id === 'undefined')) {
                                                                dataStoreCommentDetail.fpd_sender_id = element.changes[0].value.sender_id
                                                            }
                                                            if (!(typeof element.changes[0].value.sender_name === 'undefined')) {
                                                                dataStoreCommentDetail.fpd_sender_name = element.changes[0].value.sender_name;
                                                            }
                                                            if (!(typeof element.changes[0].value.message === 'undefined')) {
                                                                dataStoreCommentDetail.fpd_message = element.changes[0].value.message;
                                                            }
                                                            if (!(typeof element.changes[0].value.created_time === 'undefined')) {
                                                                dataStoreCommentDetail.fpd_created_time = element.changes[0].value.created_time;
                                                            }
                                                            dataStoreCommentDetail.fpd_comment_conversation = dataStoreCommentDetail.fpd_post_id + '_' + dataStoreCommentDetail.fpd_sender_id;
                                                            var fbCommentDetail = new Promise(function (resolve, reject) {
                                                                FB.setAccessToken(pageAccessToken);
                                                                FB.api('/' + commentId + '?fields=id,message,created_time,attachment,can_hide,can_like,like_count,parent,comments{id,message,attachment,from{id,name,link},created_time,can_hide,like_count},from{id,name,link},message_tags', function (res) {
                                                                    if (!res || res.error) reject(res.error);
                                                                    else resolve(res);
                                                                });
                                                            });
                                                            fbCommentDetail.done(function (response) {
                                                                if (!(typeof response.parent === 'undefined')) {
                                                                    dataStoreCommentDetail.fpd_parent_id = response.parent.id;
                                                                    dataStoreCommentDetail.fpd_receive_id = response.parent.from.id;
                                                                } else {
                                                                    dataStoreCommentDetail.fpd_parent_id = '';
                                                                    dataStoreCommentDetail.fpd_receive_id = element.id;
                                                                    if (!(typeof element.changes[0].value.parent_id === 'undefined')) {
                                                                        dataStoreCommentDetail.fpd_parent_id = element.changes[0].value.parent_id;
                                                                    }
                                                                }

                                                                if (!(typeof response.attachment === 'undefined') && !(typeof response.attachment.media === 'undefined') && !(typeof response.attachment.image === 'undefined')) {
                                                                    dataStoreCommentDetail.fpd_image_link = response.attachment.image.src;
                                                                } else {
                                                                    dataStoreCommentDetail.fpd_image_link = '';
                                                                    if (!(typeof element.changes[0].value.photo === 'undefined')) {
                                                                        dataStoreCommentDetail.fpd_image_link = element.changes[0].value.photo;
                                                                    }
                                                                }

                                                                if(!(typeof response.message_tags === 'undefined')){
                                                                    response.message_tags.forEach(function(element) {
                                                                        dataStoreCommentDetail.fpd_message = dataStoreCommentDetail.fpd_message.replace(element.name,'<a target=\"_blank\" href=\"https://facebook.com/' + element.id + '\">' + element.name + '</a>');
                                                                    });
                                                                }
                                                                var checkCommentDetailIsExist = commentDetailRepository.getByCommentId(commentId);
                                                                checkCommentDetailIsExist.done(function (commentDetailExist) {
                                                                    if (commentDetailExist.length) {
                                                                        commentDetailRepository.updateCreateTimeCommentDetail(commentId, dataStoreCommentDetail.fpd_created_time);
                                                                    } else {
                                                                        commentDetailRepository.createCommentDetail(dataStoreCommentDetail);
                                                                    }
                                                                })
                                                            }, function(reject){
                                                                console.log(reject);
                                                                return;
                                                            });
                                                        }
                                                    })
                                                } else {
                                                    dataUpdateCommentConversation.fpc_unread_count = 1;
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    var checkCommentIsExist = commentRepository.checkCommentConversationIsExist(dataStoreComment.fpc_id_comment_generate, facebookPageConnect[0].fac_id);
                                    checkCommentIsExist.done(function (commentExist) {
                                        var commentIdInserted = 0;
                                        if (!commentExist.length) {
                                            if (element.changes[0].value.sender_id != facebookPageConnect[0].fac_page_id) {
                                                var commentInsert = commentRepository.createCommentConversation(dataStoreComment);
                                                commentInsert.done(function (commentInserted) {
                                                    if (commentInserted) {
                                                       if(!(typeof _socket[facebookPageConnect[0].dom_name] === 'undefined')){
                                                            _socket[facebookPageConnect[0].dom_name].forEach(function(socket) {
                                                                socket.emit('feed-' + facebookPageConnect[0].dom_name, dataRealTime);
                                                            });
                                                        }
                                                    }
                                                    commentIdInserted = commentInserted;

                                                    // comment detail
                                                    var dataStoreCommentDetail = {
                                                        fpd_comment_id: commentId,
                                                        fpd_post_id: postId,
                                                        fpd_sender_id: '',
                                                        fpd_sender_name: '',
                                                        fpd_message: '',
                                                        fpd_created_time: currentTime,
                                                        fpd_read: 0,
                                                        fpd_facebook_page_connments_id: commentIdInserted
                                                    };
                                                    if (!(typeof element.changes[0].value.sender_id === 'undefined')) {
                                                        dataStoreCommentDetail.fpd_sender_id = element.changes[0].value.sender_id;
                                                    }
                                                    if (!(typeof element.changes[0].value.sender_name === 'undefined')) {
                                                        dataStoreCommentDetail.fpd_sender_name = element.changes[0].value.sender_name;
                                                    }
                                                    if (!(typeof element.changes[0].value.message === 'undefined')) {
                                                        dataStoreCommentDetail.fpd_message = element.changes[0].value.message;
                                                    }
                                                    if (!(typeof element.changes[0].value.created_time === 'undefined')) {
                                                        dataStoreCommentDetail.fpd_created_time = element.changes[0].value.created_time;
                                                    }
                                                    dataStoreCommentDetail.fpd_comment_conversation = dataStoreCommentDetail.fpd_post_id + '_' + dataStoreCommentDetail.fpd_sender_id;
                                                    var fbCommentDetail = new Promise(function (resolve, reject) {
                                                        FB.setAccessToken(pageAccessToken);
                                                        FB.api('/' + commentId + '?fields=id,message,created_time,attachment,can_hide,can_like,like_count,parent,comments{id,message,attachment,from{id,name,link},created_time,can_hide,like_count},from{id,name,link},message_tags', function (res) {
                                                            if (!res || res.error) reject(res.error);
                                                            else resolve(res);
                                                        });
                                                    });
                                                    fbCommentDetail.done(function (response) {
                                                        if (!(typeof response.parent === 'undefined')) {
                                                            dataStoreCommentDetail.fpd_parent_id = response.parent.id;
                                                            dataStoreCommentDetail.fpd_receive_id = response.parent.from.id;
                                                        } else {
                                                            dataStoreCommentDetail.fpd_parent_id = '';
                                                            dataStoreCommentDetail.fpd_receive_id = element.id;
                                                            if (!(typeof element.changes[0].value.parent_id === 'undefined')) {
                                                                dataStoreCommentDetail.fpd_parent_id = element.changes[0].value.parent_id;
                                                            }
                                                        }

                                                        if (!(typeof response.attachment === 'undefined') && !(typeof response.attachment.media === 'undefined') && !(typeof response.attachment.image === 'undefined')) {
                                                            dataStoreCommentDetail.fpd_image_link = response.attachment.image.src;
                                                        } else {
                                                            dataStoreCommentDetail.fpd_image_link = '';
                                                            if (!(typeof element.changes[0].value.photo === 'undefined')) {
                                                                dataStoreCommentDetail.fpd_image_link = element.changes[0].value.photo;
                                                            }
                                                        }

                                                        if(!(typeof response.message_tags === 'undefined')){
                                                            response.message_tags.forEach(function(element) {
                                                                dataStoreCommentDetail.fpd_message = dataStoreCommentDetail.fpd_message.replace(element.name,'<a target=\"_blank\" href=\"https://facebook.com/' + element.id + '\">' + element.name + '</a>');
                                                            });
                                                        }

                                                        var checkCommentDetailIsExist = commentDetailRepository.getByCommentId(commentId);
                                                        checkCommentDetailIsExist.done(function (commentDetailExist) {
                                                            if (commentDetailExist.length) {
                                                                commentDetailRepository.updateCreateTimeCommentDetail(commentId, dataStoreCommentDetail.fpd_created_time);
                                                            } else {
                                                                commentDetailRepository.createCommentDetail(dataStoreCommentDetail);
                                                            }
                                                        })
                                                    }, function(reject){
                                                        console.log(reject);
                                                        return;
                                                    });
                                                });
                                            }
                                        } else {
                                            commentIdInserted = commentExist[0].fpc_id;
                                            var dataUpdateComment = {
                                                fpc_message: dataStoreComment.fpc_message,
                                                fpc_read: 0,
                                                fpc_created_time: dataStoreComment.fpc_created_time,
                                                fpc_post_content: dataStoreComment.fpc_post_content,
                                                fpc_post_updated_time: dataStoreComment.fpc_post_updated_time,
                                                fpc_post_link: dataStoreComment.fpc_post_link,
                                                fpc_post_link_image: dataStoreComment.fpc_post_link_image,
                                                fpc_comment_id: commentId,
                                                fpc_reply: 0
                                            }
                                            if (!(typeof dataStoreComment.fpc_phone_include === 'undefined')) {
                                                dataUpdateComment.fpc_phone_include = dataStoreComment.fpc_phone_include;
                                            }
                                            if (!(typeof dataStoreComment.fpc_email_include === 'undefined')) {
                                                dataUpdateComment.fpc_email_include = dataStoreComment.fpc_email_include;
                                            }
                                            //xử lý số điện thoại email
                                            if (detectedPhone.status) {
                                                if (!commentExist[0].fpc_include_phone_list) {
                                                    commentExist[0].fpc_include_phone_list = "[]";
                                                }
                                                var oldListPhone = JSON.parse(commentExist[0].fpc_include_phone_list),
                                                    newListPhone = JSON.parse(dataStoreComment.fpc_include_phone_list),
                                                    listPhoneInclue = oldListPhone.concat(newListPhone).unique();
                                                dataUpdateComment.fpc_include_phone_list = JSON.stringify(listPhoneInclue);
                                            }
                                            if (detectedEmail.status) {
                                                if (!commentExist[0].fpc_include_email_list) {
                                                    commentExist[0].fpc_include_email_list = "[]";
                                                }
                                                var oldListEmail = JSON.parse(commentExist[0].fpc_include_email_list),
                                                    newListEmail = JSON.parse(dataStoreComment.fpc_include_email_list),
                                                    listEmailInclue = oldListEmail.concat(newListEmail).unique();
                                                dataUpdateComment.fpc_include_email_list = JSON.stringify(listEmailInclue);
                                            }
                                            dataUpdateComment.fpc_unread_count = commentExist[0].fpc_unread_count + 1;
                                            var checkCommentDetailIsExist = commentDetailRepository.getByCommentId(commentId);
                                            checkCommentDetailIsExist.done(function (commentDetailExist) {
                                                if (!commentDetailExist.length) {
                                                    var updateCommentConv = commentRepository.updateCommentConversation(dataStoreComment.fpc_sender_id, postId, dataUpdateComment);
                                                    updateCommentConv.done(function (val) {
                                                        if (val) {
                                                            if(!(typeof _socket[facebookPageConnect[0].dom_name] === 'undefined')){
                                                                _socket[facebookPageConnect[0].dom_name].forEach(function(socket) {
                                                                    socket.emit('feed-' + facebookPageConnect[0].dom_name, dataRealTime);
                                                                });
                                                            }
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                        if (!(commentIdInserted === 0)) {
                                            // comment detail
                                            var dataStoreCommentDetail = {
                                                fpd_comment_id: commentId,
                                                fpd_post_id: postId,
                                                fpd_sender_id: '',
                                                fpd_sender_name: '',
                                                fpd_message: '',
                                                fpd_created_time: currentTime,
                                                fpd_read: 0,
                                                fpd_facebook_page_connments_id: commentIdInserted
                                            };
                                            if (!(typeof element.changes[0].value.sender_id === 'undefined')) {
                                                dataStoreCommentDetail.fpd_sender_id = element.changes[0].value.sender_id;
                                            }
                                            if (!(typeof element.changes[0].value.sender_name === 'undefined')) {
                                                dataStoreCommentDetail.fpd_sender_name = element.changes[0].value.sender_name;
                                            }
                                            if (!(typeof element.changes[0].value.message === 'undefined')) {
                                                dataStoreCommentDetail.fpd_message = element.changes[0].value.message;
                                            }
                                            if (!(typeof element.changes[0].value.created_time === 'undefined')) {
                                                dataStoreCommentDetail.fpd_created_time = element.changes[0].value.created_time;
                                            }
                                            dataStoreCommentDetail.fpd_comment_conversation = dataStoreCommentDetail.fpd_post_id + '_' + dataStoreCommentDetail.fpd_sender_id;

                                            var fbCommentDetail = new Promise(function (resolve, reject) {
                                                FB.setAccessToken(pageAccessToken);
                                                FB.api('/' + commentId + '?fields=id,message,created_time,attachment,can_hide,can_like,like_count,parent,comments{id,message,attachment,from{id,name,link},created_time,can_hide,like_count},from{id,name,link},message_tags', function (res) {
                                                    if (!res || res.error) reject(res.error);
                                                    else resolve(res);
                                                });
                                            });
                                            fbCommentDetail.done(function (response) {
                                                if (!(typeof response.parent === 'undefined')) {
                                                    dataStoreCommentDetail.fpd_parent_id = response.parent.id;
                                                    dataStoreCommentDetail.fpd_receive_id = response.parent.from.id;
                                                } else {
                                                    dataStoreCommentDetail.fpd_parent_id = '';
                                                    dataStoreCommentDetail.fpd_receive_id = element.id;
                                                    if (!(typeof element.changes[0].value.parent_id === 'undefined')) {
                                                        dataStoreCommentDetail.fpd_parent_id = element.changes[0].value.parent_id;
                                                    }
                                                }

                                                if (!(typeof response.attachment === 'undefined') && !(typeof response.attachment.media === 'undefined') && !(typeof response.attachment.image === 'undefined')) {
                                                    dataStoreCommentDetail.fpd_image_link = response.attachment.image.src;
                                                } else {
                                                    dataStoreCommentDetail.fpd_image_link = '';
                                                    if (!(typeof element.changes[0].value.photo === 'undefined')) {
                                                        dataStoreCommentDetail.fpd_image_link = element.changes[0].value.photo;
                                                    }
                                                }

                                                if(!(typeof response.message_tags === 'undefined')){
                                                    response.message_tags.forEach(function(element) {
                                                        dataStoreCommentDetail.fpd_message = dataStoreCommentDetail.fpd_message.replace(element.name,'<a target=\"_blank\" href=\"https://facebook.com/' + element.id + '\">' + element.name + '</a>');
                                                    });
                                                }

                                                var checkCommentDetailIsExist = commentDetailRepository.getByCommentId(commentId);
                                                checkCommentDetailIsExist.done(function (commentDetailExist) {
                                                    if (commentDetailExist.length) {
                                                        commentDetailRepository.updateCreateTimeCommentDetail(commentId, dataStoreCommentDetail.fpd_created_time);
                                                    } else {
                                                        commentDetailRepository.createCommentDetail(dataStoreCommentDetail);
                                                    }
                                                })
                                            }, function(reject){
                                                console.log(reject);
                                                return;
                                            });
                                        }
                                    });
                                }
                                // Nếu page trả lời comment của khách thì update đã trả lời cho khách
                                if (element.changes[0].value.parent_id != postId && element.changes[0].value.sender_id == facebookPageConnect[0].fac_page_id) {
                                    var parentCommentConversation = commentDetailRepository.getByCommentId(element.changes[0].value.parent_id);
                                    parentCommentConversation.done(function (parentComment) {
                                        if (parentComment.length) {
                                            dataUpdateCommentConversation = {fpc_reply : 1};
                                            var checkCommentDetailIsExist = commentDetailRepository.getByCommentId(commentId);
                                            checkCommentIsExist.done(function (commentExist) {
                                                if (!commentExist.length) {
                                                    var updateCommentConv = commentRepository.updateCommentConversation(parentComment[0].fpd_sender_id, postId, dataUpdateCommentConversation);
                                                    updateCommentConv.done(function(val){
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                                // Kiểm tra comment đã có user quản lý chưa
                                // var commentConversationHasUser = commentRepository.checkCommetExistUserBySender(dataStoreComment.fpc_sender_id, postId, facebookPageConnect[0].fac_id);
                                // commentConversationHasUser.done(function (value) {
                                //     if (!value.length) {
                                //         var usersOfDomain = userRepository.getAllUsersDomain(facebookPageConnect[0].fac_domain_id);
                                //         usersOfDomain.done(function (users) {
                                //             var processUsers = new Promise(function (resolve, reject) {
                                //                 var userHasPermission = [];
                                //                 users.forEach(function (user, index) {
                                //                     var userPermission = JSON.parse(user.per_permission);
                                //                     if (!(typeof userPermission['rpage_comment.manager'] === 'undefined') && userPermission['rpage_comment.manager']) {
                                //                         userHasPermission.push(user.id);
                                //                     }
                                //                 });
                                //                 resolve(userHasPermission);
                                //             });
                                //             processUsers.done(function (userArr) {
                                //                 var conversationByUser = [];
                                //                 var processConversations = new Promise(function (resolve, reject) {
                                //                     userArr.forEach(function (u, i) {
                                //                         var totalConversation = commentRepository.countUserHasCommentConversationByPage(facebookPageConnect[0].fac_id, u);
                                //                         totalConversation.done(function (totalConversation) {
                                //                             conversationByUser.push(totalConversation[0].total_conversation);
                                //                             if (i == userArr.length - 1) {
                                //                                 resolve(conversationByUser);
                                //                             }
                                //                         });
                                //                     });
                                //                 })
                                //                 processConversations.done(function (userConversation) {
                                //                     var userHasMinConversation = userArr[userConversation.indexOf(Math.min(...userConversation))];
                                //                     commentRepository.setUserToConversation(userHasMinConversation, facebookPageConnect[0].fac_id, dataStoreComment.fpc_sender_id, postId);
                                //                 });
                                //             });
                                //         });
                                //     }
                                //     if (!value.length) {
                                //         var usersOfDomain = userRepository.getAllUsersDomain(facebookPageConnect[0].fac_domain_id);
                                //         usersOfDomain.done(function (users) {
                                //             var countUserConversation = [];
                                //             users.forEach(function (user) {
                                //                 var permissions = userRepository.getUserPermission(user.id, facebookPageConnect[0].fac_domain_id);
                                //                 permissions.done(function (permissions) {
                                //                     var userPermission = JSON.parse(permissions[0].per_permission);
                                //                     if (!(typeof userPermission['rpage_comment.manager'] === 'undefined') && userPermission['rpage_comment.manager']) {
                                //                         var totalConversation = commentRepository.countUserHasCommentConversationByPage(facebookPageConnect[0].fac_id, user.id);
                                //                         totalConversation.done(function (totalConversation) {
                                //                             countUserConversation.push(totalConversation[0].total_conversation);
                                //                         })
                                //                     }
                                //                 });
                                //             });
                                //             var userHasMinConversation = usersOfDomain[countUserConversation.indexOf(Math.min(...countUserConversation))];
                                //         });
                                //     }
                                // });

                            }, function(reject){
                                console.log(reject);
                                return;
                            });
                        }

                        if (item == "comment" && verb == "hide" && commentId) {
                            commentDetailRepository.updateHideComment(commentId);
                        }

                        if (item == "comment" && verb == "unhide" && commentId) {
                            commentDetailRepository.updateUnhideComment(commentId);
                        }

                        if (item == "comment" && verb == "remove" && commentId) {
                            commentDetailRepository.updateDeleteComment(commentId);
                        }

                        break;
                }
            });
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
