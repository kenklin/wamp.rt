//
// This is a basic router example
//
// This script runs a simple WAMP router on port 9000
// It illustrates:
// - how to filter out incoming connections,
// - how to declare a router-embedded RPC,
// - how to subscribe to router events.
//

WAMPRT_TRACE = true;

var Router = require('../lib/wamp.rt');
var program = require('commander');


program
    .option('-p, --port <port>', 'Server IP port', parseInt,9000);


function onRPCRegistered(uri) {
    console.log('onRPCRegistered RPC registered', uri);
}

function onRPCUnregistered(uri) {
    console.log('onRPCUnregistered RPC unregistered', uri);
}

function onPublish(topicUri, args) {
    console.log('onPublish Publish', topicUri, args);
}

//
// WebSocket server
//
var app = new Router(
    {
        port: program.port,
        // Optionally override the Sec-WebSocket-Protocol header
        handleProtocols: (protocols, request) => {
            return protocols.includes("wamp.2.json") ? "wamp.2.json" : false;
        }
    }
);

app.on('RPCRegistered', onRPCRegistered);
app.on('RPCUnregistered', onRPCUnregistered);
app.on('Publish', onPublish);

app.regrpc('wamp.rt.foo', function(id,args) {
    console.log('called with ' + args);
    app.resrpc(id,null,[["bar", "bar2"], {"key1": "bar1", "key2": "bar2"}]);
});
