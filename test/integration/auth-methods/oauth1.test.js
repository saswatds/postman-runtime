var expect = require('chai').expect;

describe('oauth 1', function () {
    var testrun;

    describe('correct credentials', function () {
        before(function (done) {
            // perform the collection run
            this.run({
                collection: {
                    item: {
                        request: {
                            auth: {
                                type: 'oauth1',
                                oauth1: {
                                    consumerKey: 'RKCGzna7bv9YD57c',
                                    consumerSecret: 'D+EdQ-gs$-%@2Nu7',
                                    token: '',
                                    tokenSecret: '',
                                    signatureMethod: 'HMAC-SHA1',
                                    timeStamp: 1461319769,
                                    nonce: 'ik3oT5',
                                    version: '1.0',
                                    realm: '',
                                    addParamsToHeader: true,
                                    addEmptyParamsToSign: false
                                }
                            },
                            url: 'https://postman-echo.com/oauth1',
                            method: 'GET'
                        }
                    }
                }
            }, function (err, results) {
                testrun = results;
                done(err);
            });
        });

        it('should have completed the run', function () {
            expect(testrun).to.be.ok;
            expect(testrun.done.calledOnce).to.be.ok;
            testrun.done.getCall(0).args[0] && console.error(testrun.done.getCall(0).args[0].stack);
            expect(testrun.done.getCall(0).args[0]).to.be.null;
            expect(testrun.start.calledOnce).to.be.ok;
        });

        it('should have sent the request once', function () {
            expect(testrun.request.calledOnce).to.be.ok;

            var request = testrun.request.getCall(0).args[3],
                response = testrun.request.getCall(0).args[2];

            expect(request.url.toString()).to.eql('https://postman-echo.com/oauth1');
            expect(response).to.have.property('code', 200);
        });

        it('should have sent one request internally', function () {
            expect(testrun.io.calledOnce).to.be.ok;

            var firstError = testrun.io.firstCall.args[0],
                firstRequest = testrun.io.firstCall.args[4],
                firstResponse = testrun.io.firstCall.args[3];

            expect(firstError).to.be.null;
            expect(firstRequest.url.toString()).to.eql('https://postman-echo.com/oauth1');
            expect(firstResponse).to.have.property('code', 200);
        });

        it('should have passed OAuth 1 authorization', function () {
            expect(testrun.request.calledOnce).to.be.ok;

            var request = testrun.request.getCall(0).args[3],
                response = testrun.request.getCall(0).args[2];

            expect(request.url.toString()).to.eql('https://postman-echo.com/oauth1');
            expect(response).to.have.property('code', 200);
        });
    });

    describe('disableHeaderEncoding: true', function () {
        before(function (done) {
            // perform the collection run
            this.run({
                collection: {
                    item: {
                        request: {
                            auth: {
                                type: 'oauth1',
                                oauth1: {
                                    consumerKey: 'foo!bar',
                                    consumerSecret: 'secret',
                                    signatureMethod: 'HMAC-SHA1',
                                    addParamsToHeader: true,
                                    disableHeaderEncoding: true
                                }
                            },
                            url: 'https://postman-echo.com/get',
                            method: 'GET'
                        }
                    }
                }
            }, function (err, results) {
                testrun = results;
                done(err);
            });
        });

        it('should have completed the run', function () {
            expect(testrun).to.be.ok;
            expect(testrun).to.nested.include({
                'done.calledOnce': true,
                'start.calledOnce': true
            });
            expect(testrun.done.getCall(0).args[0]).to.be.null;
        });

        it('should not encode params in Authorization header', function () {
            var response = testrun.response.getCall(0).args[2];

            expect(response).to.have.property('code', 200);
            expect(response.json().headers.authorization).to.contain('oauth_consumer_key="foo!bar"');
        });
    });

    describe('disableHeaderEncoding: false', function () {
        before(function (done) {
            // perform the collection run
            this.run({
                collection: {
                    item: {
                        request: {
                            auth: {
                                type: 'oauth1',
                                oauth1: {
                                    consumerKey: 'foo!bar',
                                    consumerSecret: 'secret',
                                    signatureMethod: 'HMAC-SHA1',
                                    addParamsToHeader: true,
                                    disableHeaderEncoding: false
                                }
                            },
                            url: 'https://postman-echo.com/get',
                            method: 'GET'
                        }
                    }
                }
            }, function (err, results) {
                testrun = results;
                done(err);
            });
        });

        it('should have completed the run', function () {
            expect(testrun).to.be.ok;
            expect(testrun).to.nested.include({
                'done.calledOnce': true,
                'start.calledOnce': true
            });
            expect(testrun.done.getCall(0).args[0]).to.be.null;
        });

        it('should encode params in Authorization header', function () {
            var response = testrun.response.getCall(0).args[2];

            expect(response).to.have.property('code', 200);
            expect(response.json().headers.authorization).to.contain('oauth_consumer_key="foo%21bar"');
        });
    });

    describe('without disableHeaderEncoding option', function () {
        before(function (done) {
            // perform the collection run
            this.run({
                collection: {
                    item: {
                        request: {
                            auth: {
                                type: 'oauth1',
                                oauth1: {
                                    consumerKey: 'foo!bar',
                                    consumerSecret: 'secret',
                                    signatureMethod: 'HMAC-SHA1',
                                    addParamsToHeader: true
                                }
                            },
                            url: 'https://postman-echo.com/get',
                            method: 'GET'
                        }
                    }
                }
            }, function (err, results) {
                testrun = results;
                done(err);
            });
        });

        it('should have completed the run', function () {
            expect(testrun).to.be.ok;
            expect(testrun).to.nested.include({
                'done.calledOnce': true,
                'start.calledOnce': true
            });
            expect(testrun.done.getCall(0).args[0]).to.be.null;
        });

        it('should encode params in Authorization header by default', function () {
            var response = testrun.response.getCall(0).args[2];

            expect(response).to.have.property('code', 200);
            expect(response.json().headers.authorization).to.contain('oauth_consumer_key="foo%21bar"');
        });
    });
});
