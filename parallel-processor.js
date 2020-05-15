var ParallelProcessor = (function(){
	var workerFn = function(){
		var sendResult = function(response, id){
			if(response.transferable){
				try{
					postMessage({id: id, result: response.result}, response.transferable);
				}catch(e){
					console.error("could not transfer objec(s): ", response.transferable);
					throw new Error("Result is not Transferable");
				}
				
			}else{
				postMessage({id: id, result: response.result});
			}
		};
		onmessage = function(e){
			var data = e.data;
			if(data.url){
				try{
					importScripts(data.url);
					if(typeof process !== "function"){
						postMessage({instructionError: "Cannot set 'process' to "+process+", which is not a function."});
						return;
					}
					if(typeof update !== "function"){
						postMessage({instructionError: "Cannot set 'update' to "+update+", which is not a function."});
						return;
					}
					postMessage({instruction: true});
				}catch(e){
					postMessage({instructionError: "Error initializing ParallelProcessor: " + e});
				}
			}else if(data.request){
				try{
					var response = {};
					var result = process(data.request.payload, response);
					if(result instanceof Promise){
						result.then(function(){
							sendResult(response, data.request.id);
						}, function(reason){
							postMessage({id: data.request.id, error: reason});
						});
					}else{
						sendResult(response, data.request.id);
					}
				}catch(e){
					postMessage({id: data.request.id, error: e.toString()});
				}
			}else if(data.update){
				try{
					update.apply(null, data.update);
					postMessage({update: true});
				}catch(e){
					postMessage({updateError: e.toString()});
				}
			}
		};
	};
	var workerFnUrl = URL.createObjectURL(new Blob(['('+workerFn.toString()+')()'], {type: "application/javascript"}));
	class ParallelProcessorWorker{
		constructor(url){
			this.latestUpdateArgs = [];
			this.url = new URL(url, location.href).toString();
			this.createWorker();
			this.busy = false;
			this.latestRequestId = undefined;
			this.latestCancellationToken = undefined;
			this.requestCounter = 0;
			this.settingInstruction = false;
			this.updating = false;
			this.resolveLatestPromise = function(){};
			this.rejectLatestPromise = function(){};
		}
		createWorker(){
			var self = this;
			this.worker = new Worker(workerFnUrl);
			this.worker.onmessage = function(e){
				var data = e.data;
				if(data.instruction){
					if(!self.settingInstruction){
						return;
					}
					self.settingInstruction = false;
					self.resolveLatestPromise();
				}else if(data.instructionError){
					if(!self.settingInstruction){
						return;
					}
					self.settingInstruction = false;
					self.rejectLatestPromise(data.instructionError);
				}else if(data.result){
					if(!self.busy || self.latestRequestId !== data.id){
						console.log("not resolving after message from worker");
						return;
					}
					self.busy = false;
					self.resolveLatestPromise(data.result);
				}else if(data.error){
					if(!self.busy || self.latestRequestId !== data.id){
						return;
					}
					self.busy = false;
					self.rejectLatestPromise(data.error);
				}else if(data.updateError){
					if(!self.updating){
						return;
					}
					self.updating = false;
					self.rejectLatestPromise(data.updateError);
				}else if(data.update){
					if(!self.updating){
						return;
					}
					self.updating = false;
					self.resolveLatestPromise();
				}
			};
			this.initialized = false;
		}
		getPromise(){
			var self = this;
			return new Promise(function(res, rej){
				self.resolveLatestPromise = res;
				self.rejectLatestPromise = rej;
			});
		}
		cancelCurrentRequest(){
			this.latestRequestId = undefined;
			this.busy = false;
			this.worker.terminate();
			this.createWorker();
		}
		async initialize(){
			if(this.initialized){
				return;
			}
			this.settingInstruction = true;
			var promise = this.getPromise();
			this.worker.postMessage({url: this.url});
			await promise;
			if(this.latestUpdateArgs.length > 0){
				await this.sendLatestUpdateArgs();
			}
			this.initialized = true;
		}
		sendLatestUpdateArgs(){
			this.updating = true;
			var promise = this.getPromise();
			this.worker.postMessage({update: this.latestUpdateArgs});
			return promise;
		}
		async update(){
			this.latestUpdateArgs = Array.prototype.slice.apply(arguments);
			await this.initialize();
			await this.sendLatestUpdateArgs();
		}
		async process(request){
			this.busy = true;
			await this.initialize();
			var self = this;
			this.latestRequestId = this.requestCounter++;
			this.latestCancellationToken = request.cancellationToken;
			var cancel = function(){self.cancelCurrentRequest();};
			if(request.cancellationToken){
				request.cancellationToken.onCancelled(function(){cancel();});
			}
			var resultPromise = this.getPromise();
			this.worker.postMessage({request: {payload: request.payload, id: this.latestRequestId}});
			try{
				var result = await resultPromise;
				request.resolve(result);
			}catch(e){
				request.reject(e);
			}finally{
				cancel = function(){};
			}
		}
	}

	class CancellationToken{
		constructor(){
			this.cancelled = false;
			this.onCancelledHandlers = [];
		}
		cancel(){
			if(this.cancelled){
				return;
			}
			this.cancelled = true;
			for(var i=0;i<this.onCancelledHandlers.length;i++){
				this.onCancelledHandlers[i]();
			}
		}
		onCancelled(handler){
			this.onCancelledHandlers.push(handler);
		}
	}

	class Request{
		constructor(payload, resolve, reject, cancellationToken){
			this.payload = payload;
			this.resolve = resolve;
			this.reject = reject;
			this.cancellationToken = cancellationToken;
		}
	}

	return class ParallelProcessor{
		constructor(threadCount, url){
			this.workers = [];
			this.requests = [];
			for(var i=0;i<threadCount;i++){
				this.workers.push(new ParallelProcessorWorker(url));
			}
		}
		async update(){
			if(this.workers.find(function(w){return w.busy;})){
				throw new Error("cannot update when requests are pending");
			}
			var args = Array.prototype.slice.apply(arguments);
			var promises = [];
			for(var i=0;i<this.workers.length;i++){
				var worker = this.workers[i];
				promises.push(worker.update.apply(worker, args));
			}
			try{
				await Promise.all(promises);
			}catch(e){
				throw new Error("Error updating parallel processor: "+e);
			}
			
		}
		async processNext(){
			this.requests = this.requests.filter(function(r){return !r.cancellationToken || !r.cancellationToken.cancelled;});
			if(this.requests.length === 0){
				return;
			}
			var freeWorker = this.workers.find(function(w){return !w.busy;});
			if(!freeWorker){
				return;
			}
			var request = this.requests.splice(0, 1)[0];
			await freeWorker.process(request);
			this.processNext();
		}
		getCancellationToken(){
			return new CancellationToken();
		}
		process(payload, cancellationToken){
			var request;
			var promise = new Promise(function(res, rej){
				request = new Request(payload, res, rej, cancellationToken);
			});
			this.requests.push(request);

			this.processNext();
			return promise;
		}
	}
})();