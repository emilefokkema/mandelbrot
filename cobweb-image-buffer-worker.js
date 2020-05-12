var createPathToScript = function(scriptName){
	return location.origin + location.pathname.replace(/[^/]*$/,scriptName);
};
importScripts(createPathToScript("parallel-processor.js"), createPathToScript("cobweb-images.js"));
var processor = new ParallelProcessor(5, createPathToScript("cobweb-processor.js"));

var imageSet = undefined;
var sendProgressUpdate = false;

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
	while(currentTime < endTime){
		var ratio = 1 - (endTime - currentTime) / nrOfMilliseconds;
		var imageIndex = Math.floor(imageSet.images.length * ratio);
		imageSet.images[imageIndex].draw(context);
		//onDisplayValue && onDisplayValue(this.images[imageIndex].value);
		await new Promise(function(res){requestAnimationFrame(res);});
		currentTime = +new Date();
	}
	postMessage({donePlaying: true});
};
onmessage = function(e){
	var data = e.data;
	if(data.instruction){
		var values = data.instruction.values;
		var imageHeight = data.instruction.imageHeight;
		loadImageSet(new CobwebImageSet(processor, values), imageHeight);
	}else if(data.sendProgressUpdate){
		sendProgressUpdate = true;
		if(imageSet){
			startSendingProgressUpdate();
		}
	}else if(data.play){
		playInTime(data.play.canvas.getContext("2d"), data.play.nrOfMilliseconds);
	}else if(data.discard){
		discard();
	}
};