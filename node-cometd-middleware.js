/*
  on startup
  - create server
  on subscribe message from client
  - create a channel (local)
  - subscribe client to channel
  - get session token from map
  - try to sub to channel (sf)
  - broker messages between sf & local channel
  */

const jsforce = require("jsforce");
const http = require("http");
const cometd = require('cometd-nodejs-server');

const loginUrl = process.env.SF_URI;
const tokenCredentialMap = process.env.SF_CRED_MAP;

/* Create a cometd server and expose it */
const cometdServer = cometd.createCometDServer({
    loglevel : 'debug'
});

const metaSubscribe = cometdServer.getServerChannel('/meta/subscribe');
const httpServer = http.createServer(cometdServer.handle);


httpServer.listen(9000, function() {
    var port = httpServer.address().port;
    _uri = 'http://localhost:' + port + '/cometd';
});



function getSubscribeRequests() {
    metaSubscribe.addListener('message', function(session, channel, message, callback) {
        var subscription = message.subscription;
        var request = cometdServer.context.request;
        var sfCredentials = '';
        var credMap = JSON.parse(tokenCredentialMap);
        
        if(request) {
            var sessionToken = request.headers['authorization'];
            sfCredentials = credMap[sessionToken];
        }

        var sfAccessToken = getSfSessionToken(sfCredentials);
        var localChannel = createServerChannel(subscription);
        doPubSub(sfAccessToken, localChannel);

        // Invoke the callback to signal that handling is complete.
        callback();
    });
}


/* Create a channel with the same name as the
   channel we created on SF */
function createServerChannel(channel) {
    return cometdServer.createServerChannel(channel);
}


/* This function subscribes to the Salesforce EMP
   /* and publishes messages to the local cometd server 
   /* that we created earlier */

function doPubSub(sfAccessToken, cometDChannel) {
    var conn = new jsforce.Connection({
        instanceUrl : loginUrl,
        accessToken : sfAccessToken
    });


    conn.streaming.topic(cometDChannel.name).subscribe(function(message) {
        cometDChannel.publish(null, message);
    });
}


// get the token for the user from the map
// create a new connection to the sf endpoint
// return the instnace of the connection
function getSfSessionToken(sfCredentials) {
    var accessToken = '';

    var conn = new jsforce.Connection({
        loginUrl : loginUrl
    });

    conn.login(sfCredentials.uid, sfCredentials.pwd, function(err, userInfo) {
        accessToken = conn.accessToken
    });

    return accessToken;
}


getSubscribeRequests();


