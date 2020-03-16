var expect = require('chai').expect;

describe.only('websocket', function () {
    var testrun;

    before(function (done) {
        this.run({
            collection: {
                item: [{
                    request: {
                        protocol: {type: 'websocket'},
                        url: 'https://postman-echo.com/get'
                    }
                }]
            }
        }, function (err, results) {
            testrun = results;
            done(err);
        });
    });

    it('should connect to the websocket server', function () {
        expect(testrun).to.be.ok;
    });
});
