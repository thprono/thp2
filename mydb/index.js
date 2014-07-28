var crypto = require('crypto');
var template = require('../template');
var http = require('http');
var util = require('../util');

function hexD(d) {
  return d + (d > 9 ? 55 : 48);
}

function toHex(id) {
  var out = '';
  for (var i = 0; i < 8; ++i) {
    out = String.fromCharCode(hexD(id & 15)) + out;
    id >>= 4;
  }
  return out;
}
exports.toHex = toHex

function identity(err, res) {return res;}

exports.makeHash = function(username, password) {
  var hash = crypto.createHash('sha512');
  var hash2 = crypto.createHash('sha512');
  return hash.update(password + hash2.update(username).digest('base64')).digest('base64')
}

exports.createUser = function(id, username, password, email, github, db) {
  db.sismember('blacklist', email, function(err, result) {
    if (!result) {
      db.sismember('brownlist', email, function(err, result) {
        var idString = toHex(id);
        var userString = 'user' + idString;
        db.hset(userString, 'id', id);
        db.hset(userString, 'username', username);
        var digest = exports.makeHash(username, password);
        db.hset(userString, 'password', digest);
        db.hset(userString, 'brownlisted', result);
        db.hset(userString, 'admitted', false);
        db.hset(userString, 'email', email);
        db.hset(userString, 'github', github);
        db.hset(userString, 'bannedUntil', 0);
        db.hset(userString, 'banReason', '');
        db.hset(userString, 'postCount', 0);
        db.zadd('users', id, id);
        db.hset('byun', username, id);
        console.log("Created user #" + idString);
      });
    }
  });
}

exports.admitUser = function(id, db) {
  var idString = toHex(id);
  var userString = 'user' + idString;
  db.hget('brownlist', db.hget(userString, 'email', identity), function(err, result) {
    db.hset(userString, 'admitted', true);
    db.hset(userString, 'infractions', result ? 149 : 0);
    db.hset(userString, 'joined', Date.now());
  });
}

exports.removeUser = function(id, db) {
  var idString = toHex(id);
  var userString = 'user' + idString;
  db.hget(userString, 'email', function(err, email) {
    db.sadd('brownlist', email);
    db.del(userString);
  });
}

exports.givePosition = function(id, pos, db) {
  var idString = toHex(id);
  var userString = 'user' + idString;
  db.hset(userString, 'pos', pos);
}

function formatProfileInfo(result) {
  var date = new Date();
  var now = date.getMilliseconds();
  var banned = result.bannedUntil > now;
  var joined = new Date(result.joined);
  date.setMilliseconds(result.bannedUntil);
  return    '<b>User #' + toHex(result.id) + '</b>' +
            (result.admitted ? '' : '<p><font color="red"><b>This member is not yet admitted</b></p>') +
            (banned ? '<p><font color="red"><b>This member is banned until ' + date.toString() + '(' + result.banReason + ')</b></p>' : '') +
            '<table><tr><td><b>Username</b></td><td>' +
            util.escape(result.username) +
            '</td></tr><tr><td><b>GitHub</b></td><td>' +
            util.escape(result.github) +
            '</td></tr><tr><td><b>Joined</b></td><td>' +
            joined +
            '</td></tr><tr><td><b>Position</b></td><td>' +
            (result.pos ? util.escape(result.pos) : 'None') +
            '</td></tr><tr><td><b>Infractions</b></td><td>' +
            result.infractions +
            '</td></tr></table>';
}

exports.getUser = function(id, db, res, req) {
  var idString = toHex(id);
  var userString = 'user' + idString;
  db.hgetall(userString, function (err, result) {
    res.end(template.wrapOutput(result.username + "'s profile", formatProfileInfo(result), req));
  });
}

exports.getUsernameById = function(id, db, res) {
  var idString = toHex(id);
  var userString = 'user' + idString;
  db.hget(userString, 'username', function (err, result) {
    res.end(result);
  });
}

exports.getAllUsers = function(page, table, db, res, req) { // e. g. getAllUsers(0, 'users', db, res)
  db.zrange(table, page * 10, page * 10 + 9, function(err, result) {
    var out = '';
    for (id in result) {
      out += '<tr class="fwu"><td><a href="/profile/' + toHex(id) +'">#' + toHex(id) + '</a></td><td>' + '</td></tr>';
    }
    res.end(template.wrapOutput("Show users", '<script>$(document).ready(function() {var $fwus = $("tr.fwu"); $fwus.each(function(index) {var children = $(this).children(); $(children[1]).load("/profile/byUN/" + $($(children[0])[0]).text().substring(1));});});</script><table><tr><td><b>ID</b></td><td><b>Username</b></td></tr>' + out + '<tr><td>' + (page ? ('<a href="/profile/table/' + table + '/' + (page - 1) +'">Prev</a></td>') : '') + '<td><a href="/profile/table/' + table + '/' + (page + 1) + '">Next</a></td>' + '</tr></table>', req));
  });
}







function checkAuth(req, res, next, req) {
  if (!req.session.user_id) {
    res.end(template.wrapOutput('Error', 'You are not logged in', req));
  } else {
    next();
  }
}







