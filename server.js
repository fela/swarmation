
/**
 * Module dependencies.
 */

var express = require('express'),
    connect = require('connect');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
    app.set('views', __dirname + '/views');
    app.use(connect.bodyDecoder());
    app.use(connect.methodOverride());
    app.use(connect.compiler({ src: __dirname + '/public', enable: ['less'] }));
    app.use(app.router);
    app.use(connect.staticProvider(__dirname + '/public'));
});

app.configure('development', function(){
    app.use(connect.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
   app.use(connect.errorHandler()); 
});

// Routes

// Only listen on $ node app.js

var port = parseInt(process.argv[2], 10) || 80;
if (!module.parent) app.listen(port);
console.log('Server now listening on port '+port+'...');