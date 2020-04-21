var ParallelProcessor = (function(){
	var workerFn = function(){
		var process = function(){};
		var update = function(){};
		onmessage = function(e){
			var data = e.data;
			if(data.instruction){
				try{
					eval(data.instruction);
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
					var result = process(data.request.payload);
					if(result instanceof ArrayBuffer){
						postMessage({id: data.request.id, result: result}, [result]);
					}else{
						postMessage({id: data.request.id, result: result});
					}
				}catch(e){
					postMessage({id: data.request.id, error: e});
				}
			}else if(data.update){
				try{
					update.apply(null, data.update);
					postMessage({update: true});
				}catch(e){
					postMessage({updateError: e});
				}
			}
		};
	};

	class ParallelProcessorWorker{
		constructor(instruction){
			var self = this;
			this.initialized = false;
			this.instruction = instruction;
			this.worker = new Worker(URL.createObjectURL(new Blob(['('+workerFn.toString()+')()'], {type: "application/javascript"})));
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
			this.busy = false;
			this.latestRequestId = undefined;
			this.latestCancellationToken = undefined;
			this.requestCounter = 0;
			this.settingInstruction = false;
			this.updating = false;
			this.resolveLatestPromise = function(){};
			this.rejectLatestPromise = function(){};
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
		}
		async initialize(){
			if(this.initialized){
				return;
			}
			this.settingInstruction = true;
			var promise = this.getPromise();
			this.worker.postMessage({instruction: this.instruction});
			await promise;
			this.initialized = true;
		}
		async update(){
			await this.initialize();
			this.updating = true;
			var args = Array.prototype.slice.apply(arguments);
			var promise = this.getPromise();
			this.worker.postMessage({update: args});
			await promise;
		}
		async process(request){
			this.busy = true;
			await this.initialize();
			var self = this;
			
			this.latestRequestId = this.requestCounter++;
			this.latestCancellationToken = request.cancellationToken;
			if(request.cancellationToken){
				request.cancellationToken.onCancelled(function(){self.cancelCurrentRequest();});
			}
			var resultPromise = this.getPromise();
			this.worker.postMessage({request: {payload: request.payload, id: this.latestRequestId}});
			try{
				var result = await resultPromise;
				request.resolve(result);
			}catch(e){
				request.reject(e);
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
		constructor(threadCount, instruction){
			this.workers = [];
			this.requests = [];
			for(var i=0;i<threadCount;i++){
				this.workers.push(new ParallelProcessorWorker(instruction));
			}
		}
		async update(){
			var args = Array.prototype.slice.apply(arguments);
			var promises = [];
			for(var i=0;i<this.workers.length;i++){
				var worker = this.workers[i];
				promises.push(worker.update.apply(worker, args));
			}
			return Promise.all(promises);
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