var doTimeout = function(milliseconds){
	var start = +new Date();
	var end = start + milliseconds;
	do{}while(+new Date() < end)
	postMessage({});
};
onmessage = function(e){
	doTimeout(e.data.milliseconds);
}