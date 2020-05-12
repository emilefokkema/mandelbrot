var createPathToScript = function(scriptName){
	return location.origin + location.pathname.replace(/[^/]*$/,scriptName);
};
importScripts(createPathToScript("parallel-processor.js"), createPathToScript("cobweb-images.js"));
var processor = new ParallelProcessor(2, createPathToScript("cobweb-processor.js"));

var imageSet = undefined;
var sendProgressUpdate = false;
var playing = false;

var startSendingProgressUpdate = function(){
	imageSet.onImageLoaded(function(){
		var ratio = imageSet.images.filter(function(i){return i.loaded;}).length / imageSet.images.length;
		postMessage({progress: {ratio: ratio}});
	});
};
var loadImageSet = async function(_imageSet, imageHeight){
	imageSet = _imageSet;
	if(sendProgressUpdate){
		startSendingProgressUpdate();
	}
	await processor.update(imageHeight);
	await imageSet.load();
	postMessage({loaded: true});
};
var discard = function(){
	for(var i=0;i<imageSet.images.length;i++){
		imageSet.images[i].discard();
	}
	postMessage({discarded: true});
};
var playInTime = async function(context, nrOfMilliseconds){
	var currentTime = +new Date();
	var endTime = currentTime + nrOfMilliseconds;
	playing = true;
	for(var i=0;i<imageSet.images.length;i++){
		imageSet.images[i].draw(context);
		await new Promise(function(res){setTimeout(res, 30)});
	}
	// while(currentTime < endTime){
	// 	var ratio = 1 - (endTime - currentTime) / nrOfMilliseconds;
	// 	var imageIndex = Math.floor(imageSet.images.length * ratio);
	// 	imageSet.images[imageIndex].draw(context);
	// 	//onDisplayValue && onDisplayValue(this.images[imageIndex].value);
	// 	await new Promise(function(res){requestAnimationFrame(res);});
	// 	currentTime = +new Date();
	// }
	playing = false;
	postMessage({donePlaying: true});
};
onmessage = function(e){
	console.log("buffer worker receives message: ", e.data);
	var data = e.data;
	if(playing){
		console.warn("received message while playing!", data)
	}
	if(data.instruction){
		var values = data.instruction.values;
		var imageHeight = data.instruction.imageHeight;
		loadImageSet(new CobwebImageSet(processor, values), imageHeight);
	}else if(data.sendProgressUpdate){
		sendProgressUpdate = true;
		if(imageSet){
			startSendingProgressUpdate();
		}
		postMessage({startedSendingProgressUpdate: true});
	}else if(data.play){
		playInTime(data.play.canvas.getContext("2d"), data.play.nrOfMilliseconds);
	}else if(data.discard){
		discard();
	}
};