var PostmanWS = require('ws').Postman,
    _ = require('lodash'),
    Emitter = require('events'),
    inherits = require('inherits'),

    RESPONSE_UPGRADE_EVENT_BASE = 'response.upgrade.',
    REQUEST_INTERNAL_EVENT_BASE = 'request.internal.',
    RESPONSE_MESSAGE_EVENT_BASE = 'response.event.',

    Websocket; // fn

/**
 * Creates a new Websocket, which is used to a websocket server
 *
 * @param trace
 * @param requester
 * @param options
 *
 * @constructor
 */
inherits(Websocket = function (trace, requester, options) {
    Websocket.super_.call(this);

    this.options = options || {};
    this.trace = trace;
    this.requester = requester;

    this.ws = new PostmanWS(options);
}, Emitter);

_.assign(Websocket.prototype, /** @lends Websocket.prototype */ {

    /**
     * Perform an Websocket connection.
     *
     * @param {String} id
     * @param {Request} request
     * @param {Object} protocolProfileBehavior
     * @param {Function} callback
     */
    connect: function (id, request, protocolProfileBehavior, callback) {
        // We take over the entire http request sending part of websocket
        // here.
        var self = this,
            onTimeout = function () {
                self.ws.emitClose();
            },
            onError = function (err) {
                self.emit('error', err);
                self.ws.emitClose();
            },
            onUpgrade = function (res, socket, head) {
                // This is where we handle the handshake
                // The user may close the connection before the upgrade event was fired
                // in such circumstance we just ignore
                if (self.ws.readyState !== PostmanWS.CONNECTING) {
                    return;
                }

                // 1. @todo check the WebsocketAcceptHeader is correct
                // 2. @todo check that server responded with correct sub protocol
                // 3. @todo parse the web-socket-extensions

                self.ws.setSocket(socket, head, self.options);

                // Attach a message handler
                self.ws.on('message', function (message) {
                    self.emit(RESPONSE_MESSAGE_EVENT_BASE + id, null, message);
                });

                // Reference the sender and send for consumption
                self.emit(RESPONSE_UPGRADE_EVENT_BASE + id, null, self.ws.send.bind(self.ws), self.ws.close.bind(self.ws));
            };

        self.requester.on(REQUEST_INTERNAL_EVENT_BASE + id, function (request) {
            // We have got the internal http/https agent that we can now use to attach the
            // upgrade events or error events
            request.on('error', function (err) {
                // If the request was aborted before the connection succeeds, the
                // error event will be fired with `Error: socket hang up`. There
                // for we will ignore the error. The web socket is not yet
                // created or established
                if (request.aborted) { return; }

                // Fire the error handler
                onError(err);
            });
            request.on('upgrade', onUpgrade);
            request.on('timeout', onTimeout);
        });

        // request function here returns an aborter function that needs to be passed
        // back so that we can handle abort
        // @todo intercept the abort to terminate the websocket connection
        return this.requester.request(id, request, protocolProfileBehavior, callback);
    },

    /**
     * Removes all current event listeners on the requester, and makes it ready for garbage collection :).
     *
     * @param {Function=} cb - Optional callback to be called on disposal
     *
     * @todo - In the future, when the requester manages its own connections etc, close them all here.
     */
    dispose: function (cb) {
        // This is safe for us, because we do not use wait on events. (i.e, no part of Runtime ever waits on
        // any event to occur). We rely on callbacks for that, only choosing to use events as a way of streaming
        // information outside runtime.
        this.removeAllListeners();

        _.isFunction(cb) && cb();
    }
});

_.assign(Websocket, /** @lends Websocket */ {
    /**
     * Asynchronously create a new websocket.
     *
     * @param trace
     * @param trace.type - type of websocket to return
     * @param trace.source - information about who needs this websocket, e.g Auth, etc.
     * @param trace.cursor - the cursor
     * @param requester - an instance of an http requester
     * @param options
     * @param callback
     * @returns {*}
     */
    create: function (trace, requester, options, callback) {
        return callback(null, new Websocket(trace, requester, options));
    }
});

module.exports.Websocket = Websocket;
