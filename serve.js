var static = require('node-static');
var http = require('http');

var file = new(static.Server)('./', {cache: 0});
http.createServer(function (req, res) {
	file.serve(req, res);
}).listen(8080);
console.log("listening on port 8080...");