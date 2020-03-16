var _ = require('lodash'),
    async = require('async'),
    uuid = require('uuid'),

    // These are functions which a request passes through _before_ being sent. They take care of stuff such as
    // variable resolution, loading of files, etc.
    prehelpers = require('../request-helpers-presend'),

    // Similarly, these run after the request, and have the power to dictate whether a request should be re-queued
    posthelpers = require('../request-helpers-postsend'),

    ReplayController = require('../replay-controller'),
    RequesterPool = require('../../requester').RequesterPool,
    WebsocketPool = require('../../requester/websocket-pool').WebsocketPool,

    RESPONSE_START_EVENT_BASE = 'response.start.',
    RESPONSE_END_EVENT_BASE = 'response.end.',
    RESPONSE_UPGRADE_EVENT_BASE = 'response.upgrade.',
    RESPONSE_MESSAGE_EVENT_BASE = 'response.event.';


// @todo we have emitting an error when upgrade of web socket fails

module.exports = {
    init: function (done) {
        var self = this;

        async.series([
            function (next) {
                // Request timeouts are applied by the requester, so add them to requester options (if any).
                // create a requester pool
                self.requester = new RequesterPool(self.options, next);
            }, function (next) {
                // Get the websocket creator
                self.websocket = new WebsocketPool(self.options, next);
            }

        ], done);
    },

    // the http trigger is actually directly triggered by the requester
    // todo - figure out whether we should trigger it from here rather than the requester.
    triggers: ['beforeRequest', 'upgrade', 'events', 'request', 'io'],

    process: {
        /**
         * @param {Object} payload
         * @param {Item} payload.item
         * @param {Object} payload.data
         * @param {Object} payload.context
         * @param {VariableScope} payload.globals
         * @param {VariableScope} payload.environment
         * @param {Cursor} payload.coords
         * @param {Boolean} payload.abortOnError
         * @param {String} payload.source
         * @param {Function} next
         *
         * @todo  validate payload
         */
        websocketconn: function (payload, next) {
            var abortOnError = _.has(payload, 'abortOnError') ? payload.abortOnError : this.options.abortOnError,
                self = this,
                context;

            context = payload.context;

            // generates a unique id for each websocket connection
            _.set(context, 'coords.wsConnectionId', payload.wsConnectionId || uuid());

            // Run the helper functions
            async.applyEachSeries(prehelpers, context, self, function (err) {
                var conn,
                    aborted,
                    item = context.item,
                    beforeRequest,
                    afterUpgrade,
                    afterRequest,
                    onMessage,
                    safeNext;

                // finish up current command
                safeNext = function (error, finalPayload) {
                    // the error is passed twice to allow control between aborting the error vs just
                    // bubbling it up
                    return next((error && abortOnError) ? error : null, finalPayload, error);
                };

                // Helper function which calls the beforeRequest trigger ()
                beforeRequest = function (err) {
                    self.triggers.beforeRequest(err, context.coords, item.request, payload.item, {
                        httpRequestId: context.coords && context.coords.httpRequestId,
                        abort: function () {
                            !aborted && conn && conn.abort();
                            aborted = true;
                        }
                    });
                };

                // Helper function to call the afterRequest trigger.
                afterRequest = function (err, response, request, cookies, history) {
                    self.triggers.request(err, context.coords, response, request, payload.item, cookies, history);
                };

                // @todo decorate the socket with an handler that will help in sending messages
                afterUpgrade = function (err, send, close) {
                    self.triggers.upgrade(err, context.coords, send, close);
                };

                onMessage = function (err, message) {
                    self.triggers.events(err, context.coords, message);
                };

                // Ensure that this is called.
                beforeRequest(null);

                if (err) {
                    // Since we encountered an error before even attempting to send the request, we bubble it up
                    // here.
                    afterRequest(err, undefined, item.request);

                    return safeNext(
                        err,
                        {request: item.request, coords: context.coords, item: context.originalItem}
                    );
                }

                if (aborted) {
                    return next(new Error('runtime: request aborted'));
                }

                async.auto({
                    requester: function (next) {
                        self.requester.create({type: 'http', source: payload.source, cursor: context.coords}, next);
                    },
                    websocket: ['requester', function (res, next) {
                        self.websocket.create(
                            {type: 'websocket', source: payload.source, cursor: context.coords},
                            res.requester,
                            next);
                    }]
                }, function (err, ref) {
                    if (err) { return next(err); }

                    var connectionId = uuid(),
                        replayOptions;

                    ref.websocket.on(RESPONSE_UPGRADE_EVENT_BASE + connectionId, function (err, sender, closer) {
                        afterUpgrade(err, sender, closer);
                    });

                    ref.websocket.on(RESPONSE_MESSAGE_EVENT_BASE + connectionId, function (err, message) {
                        onMessage(err, message);
                    });

                    // eslint-disable-next-line max-len
                    ref.requester.on(RESPONSE_START_EVENT_BASE + connectionId, function (_err, response) {
                        // we could have also added the response to the set of responses in the cloned item,
                        // but then, we would have to iterate over all of them, which seems unnecessary
                        context.response = response;

                        // run the post request helpers, which need to use the response, assigned above
                        async.applyEachSeries(posthelpers, context, self, function (error, options) {
                            if (error) {
                                return;
                            }

                            // find the first helper that requested a replay
                            replayOptions = _.find(options, {replay: true});

                            // bail out if we know that request will be replayed.
                            if (replayOptions) {
                                return;
                            }

                            // bail out if its a pm.sendRequest
                            // @todo find a better way of identifying scripts
                            // @note don't use source='script'. Script requests
                            // can trigger `*.auth` source requests as well.
                            if (context.coords && context.coords.scriptId) {
                                return;
                            }

                            // Following this we know the handshake has failed and the websocket connection could not be
                            // established. We can safely abort the request
                            !aborted && conn && conn.abort();
                            aborted = true;
                        });
                    });

                    ref.requester.on(RESPONSE_END_EVENT_BASE + connectionId, self.triggers.io.bind(self.triggers));

                    conn = ref.websocket.connect(connectionId, item.request, context.protocolProfileBehavior,
                        function (err, res, req, cookies, history) {
                            err = err || null;

                            var nextPayload = {
                                    response: res,
                                    request: req,
                                    item: context.originalItem,
                                    cookies: cookies,
                                    coords: context.coords,
                                    history: history
                                },
                                replayController;

                            // trigger the request event.
                            // @note -  we give the _original_ item in this trigger, so someone can do reference
                            //          checking. Not sure if we should do that or not, but that's how it is.
                            //          Don't break it.
                            afterRequest(err, res, req, cookies, history);

                            // Dispose off the requester, we don't need it anymore.
                            ref.requester.dispose();

                            // do not process replays if there was an error
                            if (err) {
                                return safeNext(err, nextPayload);
                            }

                            // request replay logic
                            if (replayOptions) {
                            // prepare for replay
                                replayController = new ReplayController(context.replayState, self);

                                // replay controller invokes callback no. 1 when replaying the request
                                // invokes callback no. 2 when replay count has exceeded maximum limit
                                // @note: errors in replayed requests are passed to callback no. 1
                                return replayController.requestReplay(context,
                                    context.item,
                                    {source: replayOptions.helper},
                                    // new payload with response from replay is sent to `next`
                                    function (err, payloadFromReplay) { safeNext(err, payloadFromReplay); },
                                    // replay was stopped, move on with older payload
                                    function (err) {
                                    // warn users that maximum retries have exceeded
                                    // but don't bubble up the error with the request
                                        self.triggers.console(context.coords, 'warn', (err.message || err));
                                        safeNext(null, nextPayload);
                                    }
                                );
                            }

                            return safeNext(err, nextPayload);
                        });
                });
            });
        }
    }
};
