var Runner = require('./index').Runner,
    Collection = require('postman-collection').Collection,
    runner = new Runner(); /* eslint-disable handle-callback-err, no-console */

runner.run(new Collection({
    item: [{
        request: {
            protocol: {type: 'websocket'},
            url: 'https://echo.websocket.org'
        }
    }]
}), {}, function (err, run) {
    run.start({
        // Called when the run begins
        start: function () {
            console.info('start');
        },
        upgrade: function (err, cursor, response, send, close) {
            console.log(response.headers);
            send('something to echo');
            close();
        },
        events: function (err, cursor, message) {
            console.log('events: ', message);
        }, // Called at the end of a run
        done: function () {
            // err: null or Error
            console.info('done');
        }
    });
});
