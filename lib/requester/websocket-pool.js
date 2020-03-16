var _ = require('lodash'),
    Websocket = require('./websocket').Websocket,

    DEFAULT_MAX_PAYLOAD = 100 * 1024 * 1024,

    WebsocketPool; // fn

WebsocketPool = function (options, callback) {
    var self = this;

    _.assign((self.options = {}), {
        protocolVersion: _.get(options, 'websocket.protocolVersion', 13),
        maxPayload: _.get(options, 'websocket.maxPayload', DEFAULT_MAX_PAYLOAD),
        perMessageDeflate: _.get(options, 'websocket.perMessageDeflate', false)
    });

    return callback();
};

WebsocketPool.prototype.create = function (trace, requester, callback) {
    return Websocket.create(trace, requester, this.options, callback);
};

module.exports.WebsocketPool = WebsocketPool;
