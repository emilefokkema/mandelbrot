foo.onmessage = function(msg){
	foo.postMessage("foo");
}
bar.onmessage = function(msg){
	bar.postMessage("bar")
}