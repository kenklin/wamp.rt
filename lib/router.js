// wamp.rt
// Copyright Orange 2014

var WebSocketServer = require('ws').Server,
    Session = require('./session'),
    WAMP = require('./protocol'),
    tools = require('./util'),
    log = require('./log'),
    util = require('util'),
    eventEmitter = require('events').EventEmitter;

module.exports = Router;


util.inherits(Router, eventEmitter);

function Router(options) {
    var _options = options || {};

    if (_options.disableProtocolCheck) {
        _options.handleProtocols = undefined;
    } else {
        // By default, WebSocket.Server.handleProtocols accepts only wamp.2.json
        if (typeof _options.handleProtocols !== 'function') {
            _options.handleProtocols = (protocols, request) => {
                return protocols.includes("wamp.2.json") ? "wamp.2.json" : false;
            }
        }
    }
    var _rpcs = {};
    var _pending = {};
    var _sessions = {};
    var _topics = {};
    var _trace = function (msg) {
        log.trace('[ROUTER] ' + msg);
    };
    // Instantiate WebSocketServer
    var _wss = new WebSocketServer(_options);
    // Create a Session object for the lifetime of each
    // WebSocket client object
    _wss.on('connection', function (wsclient) {
        var id = tools.randomId();
        _sessions[id] = new Session(this, wsclient);
        wsclient.on('close', function() {
            _sessions[id].cleanup();
            delete _sessions[id];
        });
    }.bind(this));

    this.close = function() {
        _wss.close();
    };

    // RPC Management
    this.getrpc = function(uri) {
        return _rpcs[uri];
    };

    this.regrpc = function(uri, rpc) {
        _trace("Registering " + uri);
        _rpcs[uri] = rpc;
        this.emit('RPCRegistered', [uri])
    };

    this.unregrpc = function(uri) {
        _trace("Unregistering " + uri);
        delete _rpcs[uri];
        this.emit('RPCUnregistered', [uri])
    };

    this.callrpc = function(uri, args, callback) {
        if (typeof this.getrpc(uri) !== 'undefined') {
            var invId = tools.randomId();
            _pending[invId] = callback;
            this.getrpc(uri).apply(this ,[invId, args]);
            return true;
        } else {
            return false;
        }
    };

    this.resrpc = function(invId, err, args) {
        if (typeof _pending[invId] !== 'undefined') {
            _pending[invId].apply(this, [err, args]);
            delete _pending[invId];
        }
    };

    // Topic Management
    this.gettopic = function(topicUri) {
        return _topics[topicUri];
    };

    this.substopic = function(topicUri, subscriptionId, callback) {
        _trace("Registering topic " + topicUri+ " subsc id " + subscriptionId);
        if (typeof _topics[topicUri] === 'undefined') {
            _topics[topicUri] = {};
        }
        _topics[topicUri][subscriptionId] = callback;
        this.emit('Subscribe', topicUri);
    };

    this.unsubstopic = function(topicUri, subscriptionId) {
        _trace("Unregistering topic " + topicUri + " subsc id " + subscriptionId);
        delete _topics[topicUri][subscriptionId];
        this.emit('Unsubscribe', topicUri);
/*
try {
    for (var id in _sessions) {
        console.log(`wamp.rt unsubstopic ${id}: ${JSON.stringify(_sessions[id])}`);
    }
    console.log();
} catch(e) {
    console.log(e.stack);
}
*/
    };

    this.publish = function(topicUri, publicationId, args, kwargs) {
        _trace("Publish " + topicUri + " " + publicationId);
        this.emit('Publish', topicUri, args, kwargs);
        if (typeof _topics[topicUri] !== 'undefined') {
            for(var subscriptionId in _topics[topicUri]) {
                if(typeof _topics[topicUri][subscriptionId] !== 'undefined') {
                    _topics[topicUri][subscriptionId].apply(this, [subscriptionId, publicationId, args, kwargs]);
                }
            }
            return true;
        } else {
            _trace("Undefined topic ");
            return false;
        }
    };
}
