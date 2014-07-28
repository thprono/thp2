function loginInfo(req) {
  return ((req && req.session.user_name) ? 'Welcome, ' + req.session.user_name + ' <a href="/logout">(Logout)</a>' : '<a href="/login">Login</a>')
}

exports.wrapOutput = function(title, output, req) {
  return '<html><head><title>' + title + ' - Touhou Prono, the intelligent programming community' + '</title><script src=http://code.jquery.com/jquery-2.1.0.min.js></script><link rel="stylesheet" type="text/css" href="/public/main.css"></head><body>' +
    '<div class="title"><p align="center"><font size=7>東方プロノ<sup>alpha</sup><sub><i>v2.0</i></sub></font></p></div>\
    <div class="user"><p align="right">' + loginInfo(req) + '</p></div>\
    <div class="menu"><p align="center"><a href="/">Home</a> <a href="/profile/">Profiles</a> <a href="/forum/">Forums</a></p></div>' +
    output + '</body></html>';
}

function kv(key, value) {
  return (value ? key + '="' + value + '" ' : ' ')
}


/*
  'fields' is a list containing structures with a 'type', 'name', and 'value' field.
 */
exports.form = function(fields, url) {
  var jq = '$("form").submit(function(e) {\
    e.preventDefault(); // Prevents the page from refreshing\
    var $this = $(this); // `this` refers to the current form element\
    $.post(\
        $this.attr("action"), // Gets the URL to sent the post to\
        $this.serialize(), // Serializes form data in standard format\
        function(data) { $(location).attr("href", "/login"); },\
        "json" // The format the response should be in\
    );\
});'
  return '<script>' + jq + '</script>' +
  '<form action="' + url +'" method="post">' +
  fields.map(function(field) {
    if (field.type == 'textarea')
      return (field.display ? field.display + ": " : '') + '<br><br><textarea rows=20 cols=80 ' + kv('name', field.name) + '>' + field.value + '</textarea>';
    return (field.display ? field.display + ": " : '') + '<input type="' + field.type +
    '" ' + kv('name', field.name) + kv('value', field.value) + '<input /><br>';
  }).join('')
  + '</form>';
}
