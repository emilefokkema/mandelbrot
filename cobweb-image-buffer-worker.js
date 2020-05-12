var createPathToScript = function(scriptName){
	return location.origin + location.pathname.replace(/[^/]*$/,scriptName);
};
importScripts(createPathToScript("parallel-processor.js"), createPathToScript("cobweb-images.js"));

var imageSet = undefined;
var sendProgressUpdate = false;
var playing = false;

class Timeout{
	constructor(){
		var self = this;
		this.worker = new Worker(createPathToScript("timeout-worker.js"));
		this.worker.onmessage = function(){
			self.resolvePromise && self.resolvePromise();
		};
		this.resolvePromise = undefined;
	}
	fromMilliseconds(milliseconds){
		var self = this;
		var promise = new Promise(function(res){self.resolvePromise = res;});
		this.worker.postMessage({milliseconds: milliseconds});
		return promise;
	}
}
var timeout = new Timeout();
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
	imageSet.onImageLoaded(reportProgress);
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
	postMessage({discarded: true});
};
var playInTime = async function(context, nrOfMilliseconds){
	var currentTime = +new Date();
	var endTime = currentTime + nrOfMilliseconds;
	playing = true;
	for(var i=0;i<imageSet.images.length;i++){
		imageSet.images[i].draw(context);
		await timeout.fromMilliseconds(30);
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
		var processor = new ParallelProcessor(10, createPathToScript("cobweb-processor.js"));
		loadImageSet(new CobwebImageSet(processor, values), imageHeight, processor);
	}else if(data.sendProgressUpdate){
		sendProgressUpdate = true;
		if(imageSet){
			startSendingProgressUpdate();
		}
		postMessage({startedSendingProgressUpdate: true, ratio: getProgress()});
	}else if(data.play){
		playInTime(data.play.canvas.getContext("2d"), data.play.nrOfMilliseconds);
	}else if(data.discard){
		discard();
	}
};