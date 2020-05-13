var createPathToScript = function(scriptName){
	return location.origin + location.pathname.replace(/[^/]*$/,scriptName);
};
importScripts("parallel-processor.js", "cobweb-images.js");
var processor = new ParallelProcessor(10, createPathToScript("cobweb-processor.js"));

var imageSet = undefined;
var sendProgressUpdate = false;
var playing = false;

var debounce = function(f, timeout){
	var latestArgs = undefined;
	var called = false;
	var underway = false;
	var doCall = function(){
		underway = true;
		called = false;
		f.apply(null, latestArgs);
		setTimeout(function(){
			underway = false;
			if(called){
				doCall();
			}
		}, timeout);
	};
	var result = function(){
		latestArgs = Array.prototype.slice.apply(arguments);
		if(underway){
			called = true;
		}else{
			doCall();
		}
	};
	return result;
}
var getProgress = function(){
	if(!imageSet){
		return 0;
	}
	return imageSet.images.filter(function(i){return i.loaded;}).length / imageSet.images.length;
};
var reportProgress = debounce(function(){
	var ratio = getProgress();
	postMessage({progress: {ratio: ratio}});
}, 10);
var startSendingProgressUpdate = function(){
	imageSet.addImageLoadedHandler(reportProgress);
};
var stopSendingProgressUpdate = function(){
	imageSet.removeImageLoadedHandler(reportProgress);
};
var loadImageSet = async function(_imageSet, imageHeight, processor){
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
	stopSendingProgressUpdate();
	sendProgressUpdate = false;
	imageSet = undefined;
	postMessage({discarded: true});
};
var playInTime = async function(context, nrOfMilliseconds){
	var currentTime = +new Date();
	var endTime = currentTime + nrOfMilliseconds;
	playing = true;
	var images = imageSet.images.slice();
	for(var i=0;i<images.length;i++){
		if(i===0){
			console.log("start displaying at value ", images[i].value)
		}
		if(i===images.length - 1){
			console.log("done displaying at value ", images[i].value)
		}
		images[i].draw(context);
		images[i].discard();
		await new Promise(function(res){setTimeout(res, 30);})
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
	var data = e.data;
	if(playing){
		console.warn("received message while playing!", data)
	}
	if(data.instruction){
		var values = data.instruction.values;
		var imageHeight = data.instruction.imageHeight;
		
		loadImageSet(new CobwebImageSet(processor, values), imageHeight, processor);
	}else if(data.sendProgressUpdate){
		if(!sendProgressUpdate){
			sendProgressUpdate = true;
			if(imageSet){
				startSendingProgressUpdate();
			}
		}
		postMessage({startedSendingProgressUpdate: true, ratio: getProgress()});
	}else if(data.play){
		playInTime(data.play.canvas.getContext("2d"), data.play.nrOfMilliseconds);
	}else if(data.discard){
		discard();
	}else if(data.stopSendingProgressUpdate){
		if(sendProgressUpdate){
			sendProgressUpdate = false;
			if(imageSet){
				stopSendingProgressUpdate();
			}
		}
		postMessage({stoppedSendingProgressUpdate: true});
	}
};