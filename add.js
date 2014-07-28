var http = require('http');
var url = require('url');
var path = require('path');

var server = http.createServer(function(req, res) {
  var thePath = url.parse(req.url).pathname;
  var b = path.basename(thePath) - 0;
  var a = path.basename(path.normalize(thePath + "/..")) - 0;
  var op = path.basename(path.normalize(thePath + "/../.."));
  var ans = ((op == 'add') ? (a + b) :
    (op == 'subtract') ? (a - b) :
    (op == 'multiply') ? (a * b) :
    (op == 'divide') ? (a / b) :
    (op == 'remainder') ? (a % b) : 0);
  res.writeHead(200);
  res.end('When you ' + op + ' ' +
  a + ' and ' + b + ", you get " + ans + '!');
});
server.listen(8080);
