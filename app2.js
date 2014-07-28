var express    = require('express')
var bodyParser = require('body-parser')

var app = express()

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// parse application/vnd.api+json as json
app.use(bodyParser.json({ type: 'application/vnd.api+json' }))

app.get('/', function (req, res, next) {
  console.log(req.body) // populated!
  next()
})

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
