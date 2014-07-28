var mydb = require('../mydb');
var template = require('../template');
var path = require('path');
var fs = require('fs');
var uuid = require('uuid');
var url = require('url');
var util = require('../util');

var queue = [];
var t = 0;

function parseCatWithX(category, init) {
  return init + category.join('x');
}

function parseCatWith(category, init) {
  var p = init;
  for (var i in category) {
    var c = category[i] + '';
    p = path.join(p, c);
  }
  return p;
}

function parseCat(category) { return parseCatWith(category, process.cwd() + '/forum/data'); }

function post(category, thread, body, id, db) {
  var success = undefined;
  db.hget('user' + mydb.toHex(id), 'bannedUntil', function(err, bannedUntil) {
    if (Date.now() < bannedUntil) {success = false; return;};
    var p = path.join(parseCat(category), 'thread-' + thread);
    var pjn = path.join(p, 'posts.txt');
    var postsRaw = fs.readFileSync(pjn, 'utf8');
    var postUUID = uuid.v4();
    var postBody = {'user': id, 'body': body, 'date': Date.now()};
    fs.writeFile(path.join(p, 'post-' + postUUID + '.json'), JSON.stringify(postBody), 'utf8');
    fs.writeFile(pjn, postsRaw + (postsRaw ? '\n' : '') + postUUID, 'utf8');
    success = true;
  });
  //while (success === undefined);
  console.log('ding!');
  return success;
}

function edPost(category, thread, postUUID, body, id, db) {
  db.hget('user' + mydb.toHex(id), 'bannedUntil', function(err, bannedUntil) {
    if (Date.now() < bannedUntil) return;
    var p = path.join(parseCat(category), 'thread-' + thread);
    var postBody = {'user': id, 'body': body, 'date': Date.now()};
    fs.writeFileSync(path.join(p, 'post-' + postUUID + '.json'), JSON.stringify(postBody), 'utf8');
  });
}

function delPost(category, thread, postUUID, id, db) {
  db.hget('user' + mydb.toHex(id), 'bannedUntil', function(err, bannedUntil) {
    if (Date.now() < bannedUntil) return;
    var p = path.join(parseCat(category), 'thread-' + thread);
    var pjn = path.join(p, 'posts.txt');
    var posts = fs.readFileSync(pjn, 'utf8').split('\n').filter(function(s) {return s != ''});
    fs.writeFileSync(pjn, posts.filter(function(id) {return id != postUUID;}).join('\n'), 'utf8');
    fs.unlink(path.join(p, 'post-' + postUUID + '.json')); // this file won't be visible anymore; ok to remove async
  });
}

function createThread(category, title, body, id, db) {
  db.hget('user' + mydb.toHex(id), 'bannedUntil', function(err, bannedUntil) {
    if (Date.now() < bannedUntil) return;
    var threadUUID = uuid.v4();
    var cp = parseCat(category);
    var p = path.join(cp, 'thread-' + threadUUID);
    var pjn = path.join(p, 'posts.txt');
    fs.mkdir(p, function(err) {
      fs.writeFileSync(pjn, '', 'utf8');
      post(category, threadUUID, body, id, db);
    });
    var tjn = path.join(cp, 'threads.json');
    var threadData = JSON.parse(fs.readFileSync(tjn)).concat({
      'uuid': threadUUID,
      'title': title,
      'user': id,
      'date': Date.now()
    });
    fs.writeFileSync(tjn, JSON.stringify(threadData), 'utf8');
  });
}

function deleteThread(category, thread, id, db) {
  db.hget('user' + mydb.toHex(id), 'bannedUntil', function(err, bannedUntil) {
    if (Date.now() < bannedUntil) return;
    var cp = parseCat(category);
    var tjn = path.join(cp, 'threads.json');
    var threadData = JSON.parse(fs.readFileSync(tjn)).filter(function(elem) {
      return elem.uuid != thread;
    });
    fs.writeFileSync(tjn, JSON.stringify(threadData), 'utf8');
    var p = path.join(cp, 'thread-' + thread);
    fs.rmdirSync(p);
  });
}

function dequeue(db) {
  if (queue.length) {
    var request = queue.pop();
    switch (request.type) {
      case 'post': return post(request.category, request.thread, request.body, request.id, db);
      case 'edPost': return edPost(request.category, request.thread, request.postUUID, request.body, request.id, db);
      case 'delPost': return delPost(request.category, request.thread, request.postUUID, request.id, db);
      case 'createThread': return createThread(request.category, request.title, request.body, request.id, db);
      case 'deleteThread': return deleteThread(request.category, request.thread, request.id, db);
    }
  }
}

function catsToHTML(cats, accum) {
  var out = '<ol>';
  for (var i in cats) {
    var cat = cats[i];
    console.log(JSON.stringify(cat));
    out += '<li><a href="' + parseCatWithX(accum.concat(cat.id), '/forum/') + '">' + util.escape(cat.name) + '</a> <div class="desc">' + util.escape(cat.desc) + '</div>';
    if (cat.sub) out += catsToHTML(cat.sub, accum.concat(cat.id));
  }
  return out + '</ol>';
}

var jsq = '<script>$(document).ready(function() {var $fwus = $("a.fwu"); $fwus.each(function(index) {var $this = $(this); $this.load("/profile/byUN/" + $(this).text());});});</script>';

exports.viewCat = function(cat, req) {
  var out = jsq + '<a href="' + parseCatWithX(cat.slice(0, -1), '/forum/') + '">Back</a> <a href="' + path.join(url.parse(req.url).pathname, 'newthread') + '">New thread</a><ol>';
  var p = path.join(parseCat(cat), 'threads.json');
  var threads = JSON.parse(fs.readFileSync(p, 'utf8'));
  out += threads.reverse().map(function(thread) {
    return '<li><a href="' + path.join(parseCatWithX(cat, '/forum/'), 'thread', thread.uuid) + '">' + util.escape(thread.title) + '</a> by <a href="/profile/' + mydb.toHex(thread.user) + '" class="fwu">' + mydb.toHex(thread.user) + '</a> on ' + new Date(thread.date).toString() + '</li>'
  }).join('');
  return out + '</ol>';
}

exports.viewThread = function(cat, thread, page, req) {
  var out = jsq + '<a href="' + path.join(url.parse(req.url).pathname, '../..') + '">Back to category</a> <a href="' + path.join(url.parse(req.url).pathname, 'reply') + '">Reply</a><ol>';
  var p = path.join(parseCat(cat), 'thread-' + thread, 'posts.txt');
  var q = path.join(parseCat(cat), 'thread-' + thread, 'post-');
  var posts = fs.readFileSync(p, 'utf8').split('\n').filter(function(s) {return s != ''}).slice(10 * page, 10 * page + 9);
  for (var i in posts) {
    var postUUID = posts[i];
    var post = JSON.parse(fs.readFileSync(q + postUUID + '.json', 'utf-8'));
    out += '<li><a class="fwu" href="/profile/' + mydb.toHex(post.user) +'">' + mydb.toHex(post.user) + '</a> posted on ' + new Date(post.date).toString() + ': <div class="desc">' + util.escapel(post.body) + '</div>';
  }
  return out + '</ol>';
}

exports.enableRequests = function(db) {
  console.log(parseCat([1,4,3,6]));
  t = setInterval(function() {dequeue(db);}, 2000);
  fs.readFile(process.cwd() + '/forum/data/cats.json', 'utf8', function(err, contents) {
    exports.cats = JSON.parse(contents);
    exports.catsAsHTML = catsToHTML(exports.cats, []);
  });
}

exports.request = function(request) {
  queue.push(request);
}
