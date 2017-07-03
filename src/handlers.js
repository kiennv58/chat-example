/**
 * Nhận dữ liệu từ kênh pubsub của PHP để tiến hành push  
 * realtime notifies conversation và comment cho ứng dụng.
 * @param channel Kênh pubsub `ps_php_node`
 * @param message Data nhận từ PHP publish
 * @return void
 */
function notifyHandler (channel, message) {
    var data = JSON.parse(message);
    switch (data.type) {
        case 1: // emit conversation
            socket.emit('conv-' + data.dom_name, data);
            break;

        case 2: // emit feed
            socket.emit('feed-' + data.dom_name, data);
            break;
    }
}

/**
 * Nhận dữ liệu từ kênh pubsub của PHP để tiến hành request lên 
 * facebook để like 1 comment của user 
 * @param channel Kênh pubsub `ps_like_comment`
 * @param message Data nhận từ PHP publish
 * @return void
 */
function likeCommentHandler (channel, message) {
    var data = JSON.parse(message);
    FB.setAccessToken(data.access_token);
    FB.api('/' + data.comment_id + '/likes', 'post', {}, function(res) {
        if (!res || res.error) {
            console.log(!res ? 'error occurred' : res.error);
            return;
        }
    });
}

/**
 * Nhận dữ liệu từ kênh pubsub của PHP để tiến hành request lên 
 * facebook để ẩn 1 comment của user 
 * @param channel Kênh pubsub `ps_hide_comment`
 * @param message Data nhận từ PHP publish
 * @return void
 */
function hideCommentHandler (channel, message) {
    var data = JSON.parse(message);
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
 * Nhận dữ liệu từ kênh pubsub của PHP để tiến hành request lên 
 * facebook để reply comment của user 
 * @param channel Kênh pubsub `ps_reply_comment`
 * @param message Data nhận từ PHP publish
 * @return void
 */
function replyCommentHandler (channel, message) {
    var data = JSON.parse(message);
    FB.setAccessToken(data.access_token);
    FB.api('/' + data.comment_id + '/comments', 'post', { message: data.message }, function(res) {
        if (!res || res.error) {
            console.log(!res ? 'error occurred' : res.error);
            return;
        }
    });
}

module.exports = {
  notifyHandler,
  likeCommentHandler,
  hideCommentHandler,
  replyCommentHandler
}