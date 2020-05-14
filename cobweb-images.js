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
		this.onImageLoadedHandlers = [];
		this._loadingPromise = undefined;
		this.processor = processor;
	}
	discardAll(){
		var images = this.images.slice();
		for(var i=0;i<images.length;i++){
			images[i].discard();
		}
	}
	removeImage(image){
		var index = this.images.indexOf(image);
		if(index > -1){
			this.images.splice(index, 1);
		}
	}
	addImageLoadedHandler(onImageLoadedHandler){
		this.onImageLoadedHandlers.push(onImageLoadedHandler);
	}
	removeImageLoadedHandler(onImageLoadedHandler){
		var index = this.onImageLoadedHandlers.indexOf(onImageLoadedHandler);
		if(index > -1){
			this.onImageLoadedHandlers.splice(index, 1);
		}
	}
	handleImageLoaded(image){
		for(var i=0;i<this.onImageLoadedHandlers.length;i++){
			this.onImageLoadedHandlers[i](image);
		}
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
				this.handleImageLoaded(images[i]);
			}
		}
	}
	async load(){
		var promises = [];
		var batchSize = 20;
		var numberOfBatches = Math.ceil(this.images.length / batchSize);
		for(var i=0;i<numberOfBatches;i++){
			var batch = this.images.slice(i * batchSize, (i + 1) * batchSize);
			promises.push(this.loadImageBatch(batch));
		}
		await Promise.all(promises);
	}
}