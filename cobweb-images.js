class CobwebImage{
	constructor(value){
		this.value = value;
		this.image = undefined;
		this.onDiscardedHandlers = [];
		this.discarded = false;
	}
	get loaded(){return !!this.image;}
	draw(ctx){
		if(!this.image){
			console.warn("image not present!");
			return;
		}
		ctx.drawImage(this.image, 0, 0);
	}
	onDiscarded(handler){
		this.onDiscardedHandlers.push(handler);
	}
	discard(){
		if(this.discarded){
			return;
		}
		for(var i=0;i<this.onDiscardedHandlers.length;i++){
			this.onDiscardedHandlers[i]();
		}
		if(this.image){
			this.image.close();
			this.image = undefined;
		}
		this.discarded = true;
	}
}
class CobwebImageSet{
	constructor(processor, values){
		var self = this;
		this.images = values.map(function(v){
			var image = new CobwebImage(v);
			image.onDiscarded(function(){self.removeImage(image);});
			return image;
		});
		this.onImageLoadedHandler = undefined;
		this._loadingPromise = undefined;
		this.processor = processor;
	}
	removeImage(image){
		var index = this.images.indexOf(image);
		if(index > -1){
			this.images.splice(index, 1);
		}
	}
	onImageLoaded(onImageLoadedHandler){
		this.onImageLoadedHandler = onImageLoadedHandler;
	}
	async loadImageBatch(images){
		var cancellationToken = this.processor.getCancellationToken();
		var numberOfImagesToLoad = images.length;
		for(var i=0;i<images.length;i++){
			images[i].onDiscarded(function(){
				if(--numberOfImagesToLoad <= 0){
					cancellationToken.cancel();
				}
			});
		}
		var imageBitmaps = await this.processor.process({values: images.map(function(i){return i.value;})}, cancellationToken);
		
		for(var i=0;i<images.length;i++){
			images[i].image = imageBitmaps[i];
			if(!images[i].discarded){
				this.onImageLoadedHandler && this.onImageLoadedHandler(images[i]);
			}
		}
	}
	async loadImages(){
		var start = +new Date();
		var promises = [];
		var batchSize = 20;
		var numberOfBatches = Math.ceil(this.images.length / batchSize);
		for(var i=0;i<numberOfBatches;i++){
			var batch = this.images.slice(i * batchSize, (i + 1) * batchSize);
			promises.push(this.loadImageBatch(batch));
		}
		await Promise.all(promises);
		console.log("loaded buffer images in "+(+new Date() - start)+" ms");
	}
	load(){
		if(!this._loadingPromise){
			this._loadingPromise = this.loadImages();
		}
		return this._loadingPromise;
	}
}