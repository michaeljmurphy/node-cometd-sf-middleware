const jsforce = require("jsforce");
const http = require("http");
const async = require("async");
const cometd = require('cometd-nodejs-server');


const loginUrl = process.env.SF_URI;
const uid = process.env.SF_UID;
const pwd = process.env.SF_PWD;
const channel = process.env.SF_CHANNEL;

const conn = new jsforce.Connection({
    loginUrl : loginUrl
});



/* Create a cometd server and expose it */
const cometdServer = cometd.createCometDServer({
    loglevel : 'debug'
});
const httpServer = http.createServer(cometdServer.handle);
httpServer.listen(9000, function() {
    var port = httpServer.address().port;
    console.log('listening on localhost:' + port);
    _uri = 'http://localhost:' + port + '/cometd';
});

/* Create a channel with the same name as the
   channel we created on SF */
const cometDChannel = cometdServer.createServerChannel(channel);
console.dir(cometDChannel);
console.dir(cometDChannel.publish);

/* This function subscribes to the Salesforce EMP
/* and publishes messages to the local cometd server 
/* that we created earlier */
function doPubSub() {
    console.log('doSubscribe(): ' + channel);
    conn.streaming.topic(channel).subscribe(function(message) {
        console.log('*** SF Listener');
        console.dir(message);
        cometDChannel.publish(null, message);
    });
}

/* In parallel we need to create a session
/* with SF and listen to messages that are
/* published to the cometd server we created
/* so that we can check it is working.  
/* This will not be necessary outside
/* of testing purposes */
async.parallel([
    function doLogin() {
        console.log('doLogin()');
        conn.login(uid, pwd, function(err, userInfo) {
            if (err) { return console.error(err); }
            // Now you can get the access token and instance URL information.
            // Save them to establish connection next time.bscra
            console.log('URI: ' + conn.instanceUrl);
            console.log('Access Token: ' + conn.accessToken);
            // logged in user property
            console.log("User ID: " + userInfo.id);
            console.log("Org ID: " + userInfo.organizationId);

            doPubSub();
        });
    },

    function listenToChannel() {
        console.log('listenToChannel()');

        cometDChannel.addListener('message', function(session, channel, message, callback) {
            // Your message handling here.
            console.log('*** CometD Listener');
            console.dir(message);

            // Invoke the callback to signal that handling is complete.
            callback();
        });
    }
]);
