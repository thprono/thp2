var express = require('express');
var redis = require('redis');
var http = require('http');
var url = require('url');
var path = require('path');
var app = express();
var db = redis.createClient();
var mydb = require('./mydb');
var template = require('./template');
var bodyParser = require('body-parser');
var fs = require('fs');
var forum = require('./forum');
var util = require('./util');
var uuid = require('uuid');

forum.enableRequests(db);

global.homedir = process.cwd();

//redis.debug_mode = true;

var session = require('express-session');
var cookieParser = require('cookie-parser');
var RedisStore = require('connect-redis')(session);

app.use(cookieParser());
app.use(session({
  store: new RedisStore({
    host: 'localhost',
    port: 6379,
    db: 2,
    pass: 'RedisPASS'
  }),
  genid: function(req) {
    return uuid.v4(); // use UUIDs for session IDs
  },
  secret: '7cDkfc9+4bmv6vrSbBvb8LcyzXPcCkyr00/RItwMxYoqVyXYDAa8nTOG7C9OOKmsu7S+N8jMWMeTBVu95d6Edg=='
}));
app.use(bodyParser());


app.get('/bc/*', function(req, res) {
  var thePath = url.parse(req.url).pathname;
  var b = parseInt(path.basename(thePath));
  var a = parseInt(path.basename(path.normalize(thePath + "/..")));
  var op = path.basename(path.normalize(thePath + "/../.."));
  var ans = ((op == 'add') ? (a + b) :
    (op == 'subtract') ? (a - b) :
    (op == 'multiply') ? (a * b) :
    (op == 'divide') ? (a / b) :
    (op == 'remainder') ? (a % b) : 0);
  res.writeHead(200);
  res.end(template.wrapOutput('The oracle says...',
    'When you ' + op + ' ' +
    a + ' and ' + b + ", you get " + ans + '!'), req);
});

app.get('/profile/byUN/*', function(req, res) {
  var userid = parseInt(path.basename(req.path), 16);
  res.writeHead(200);
  mydb.getUsernameById(userid, db, res);
});

app.get('/profile/table/*', function(req, res) {
  var thePath = url.parse(req.url).pathname;
  var b = parseInt(path.basename(thePath));
  var a = path.basename(path.normalize(thePath + "/.."));
  res.writeHead(200);
  mydb.getAllUsers(b, a, db, res, req);
});

app.get('/profile/', function(req, res) {
  res.writeHead(200);
  mydb.getAllUsers(0, 'users', db, res, req);
});

app.get('/profile/*', function(req, res) {
  var userid = parseInt(path.basename(req.path), 16);
  res.writeHead(200);
  mydb.getUser(userid, db, res, req);
});

var loginForm = [
  {
    type: 'text',
    name: 'user',
    display: 'Username'
  },
  {
    type: 'password',
    name: 'password',
    display: 'Password'
  },
  {
    type: 'submit',
    value: 'Submit'
  }
];

app.get('/login', function(req, res) {
  res.writeHead(200);
  res.end(template.wrapOutput('Login', 
    (req.session.user_name ? 'You are already logged in.' :
      template.form(loginForm, '/login'))));
});

app.post('/login', function(req, res) {
  var post = req.body;
  db.hexists('byun', post.user, function(err, result) {
    if (result) {
      db.hget('byun', post.user, function(err, result) {
        var id = result;
        var userString = 'user' + mydb.toHex(id);
        db.hgetall(userString, function(err, result) {
          if (mydb.makeHash(post.user, post.password) == result.password) {
            req.session.user_name = post.user;
            req.session.user_id   = id;
            req.session.admitted  = result.admitted;
            req.session.position  = result.pos;
            res.end(template.wrapOutput('Login successful', 'You have successfully been logged in as ' + req.session.user_name + '.'));
          } else {
            res.end(template.wrapOutput('Error', 'Wrong password', req));
          }
        });
      });
    } else {
      res.end(template.wrapOutput('Error', 'User does not exist', req));
    }
  });
});

app.get('/logout', function (req, res) {
  delete req.session.user_id;
  delete req.session.user_name;
  delete req.session.admitted;
  delete req.session.position;
  res.redirect('/login');
});

app.get('/forum', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', forum.catsAsHTML, req));
  }
});

function parsedec(x) { return parseInt(x, 10); }
function xtopath(c) { return c.split('x').map(parsedec) };
var admsg_admitted = "You must be admitted to view this page!";

app.get('/forum/:a', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    var cat = xtopath(req.params.a);
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', forum.viewCat(cat, req), req));
  }
});

app.get('/forum/:a/thread/:b/reply', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    var cat = xtopath(req.params.a);
    var thread = req.params.b;
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', template.form(replyForm, 'reply/'), req));
  }
});

var replyForm = [
  {
    type: 'textarea',
    name: 'content',
    display: 'Content'
  },
  {
    type: 'submit',
    value: 'Submit'
  }
];

app.post('/forum/:a/thread/:b/reply', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    var cat = xtopath(req.params.a);
    var thread = req.params.b;
    var success = forum.request({
      "type": "post",
      "category": cat,
      "thread": thread,
      "body": req.body.content,
      "id": req.session.user_id
    });
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', 'Message successfully posted.<br><a href="..">Back<a>', req));
  }
});
app.get('/forum/:a/thread/:b/:c', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    var cat = xtopath(req.params.a);
    var thread = req.params.b;
    var page = req.params.c;
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', forum.viewThread(cat, thread, page, req), req));
  }
});

app.get('/forum/:a/thread/:b', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    var cat = xtopath(req.params.a);
    var thread = req.params.b;
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', forum.viewThread(cat, thread, 0, req), req));
  }
});

var threadForm = [
  {
    type: 'text',
    name: 'title',
    display: 'Title'
  },
  {
    type: 'textarea',
    name: 'content',
    display: 'Content'
  },
  {
    type: 'submit',
    value: 'Submit'
  }
];

app.get('/forum/:a/newthread', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    var cat = xtopath(req.params.a);
    var thread = req.params.b;
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', template.form(threadForm, 'newthread/'), req));
  }
});

app.post('/forum/:a/newthread', function(req, res) {
  if (!req.session.admitted) {
    res.writeHead(403);
    res.end(template.wrapOutput('Error', admsg_admitted, req));
  } else {
    var cat = xtopath(req.params.a);
    var thread = req.params.b;
    var success = forum.request({
      "type": "createThread",
      "category": cat,
      "title": req.body.title,
      "body": req.body.content,
      "id": req.session.user_id
    });
    res.writeHead(200);
    res.end(template.wrapOutput('Forums', 'Message successfully posted.<br><a href="..">Back<a>', req));
  }
});

app.get('/', function(req, res) {
  res.writeHead(200);
  res.end(template.wrapOutput("Home", '<b>Welcome to Touhou Prono!</b><br>' +
    'Touhou Prono was founded in 2014 January 26 in the event of blue_bear_94’s (#00000000) temporary ban from Omnimaga. It strives to be a programming community free from incompetent nineballs who ask stupid questions and say other stupid stuff.'
  , req))
});

app.get('/public/:a', function(req, res) {
  fs.readFile(global.homedir + '/public/' + req.params.a, function(err, data) {
    if (err) {
      res.writeHead(404);
      res.end(template.wrapOutput("page not found", "<b>404</b><br>page not found", req));
    } else {
      res.writeHead(200);
      res.end(data);
    }
  });
});

app.get('/*', function(req, res) {
  res.writeHead(404);
  res.end(template.wrapOutput("page not found", "<b>404</b><br>page not found", req));
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});

require('./test').createData(db);
