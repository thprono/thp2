var mydb = require('../mydb');
var forum = require('../forum');

exports.createData = function (db) {
  mydb.createUser(0, 'blue_bear_94', 'password', 'tkook11@gmail.com', 'bluebear94', db);
  mydb.admitUser(0, db);
  mydb.givePosition(0, 'Leader', db);
  mydb.createUser(1, 'THISiSNTDIVYESH', 'password', 'goshthisisveryweird@gmail.com', 'divyeshd', db);
  mydb.admitUser(1, db);
  mydb.createUser(2, 'waterdevil00', 'password', 'something@gmail.com', 'jackdare2', db);
  mydb.admitUser(2, db);
  /*forum.request({
    "type": "createThread",
    "category": [1],
    "title": "hello world",
    "body": "Hi.",
    "id": 0
  });*/
  console.log("users created");
}
