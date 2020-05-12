(function(){
	var height;
	var drawForValue = async function(r){
		var canvas = new OffscreenCanvas(height, height);
		var ctx = canvas.getContext("2d");
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, height, height);
		ctx.beginPath();
		ctx.moveTo(0, height);
		ctx.quadraticCurveTo(height / 2, height * (1 - r / 2), height, height);
		ctx.moveTo(0, height);
		ctx.lineTo(height, 0);
		ctx.stroke();

		var value = 0.5;
		var counter = 0;
		ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
		ctx.lineWidth = 0.1;
		while(counter < 40000){
			ctx.beginPath();
			ctx.moveTo(value * height, (1 - value) * height);
			var newValue = r * value * (1 - value);
			ctx.lineTo(value * height, (1 - newValue) * height);
			ctx.lineTo(newValue * height, (1 - newValue) * height);
			ctx.stroke();
			value = newValue;
			//hue += 0.03;
			counter++;
		}
		var blob = await canvas.convertToBlob({type: "image/jpeg", quality: 1});
		return createImageBitmap(blob);
	};
	var addToResult = async function(value, res, index){
		var bitmap = await drawForValue(value);
		res.result[index] = bitmap;
		res.transferable[index] = bitmap;
	};
	process = function(req, res){
		var values = req.values;
		res.transferable = new Array(values.length)
		res.result =  new Array(values.length);
		return Promise.all(values.map(function(v, i){return addToResult(v, res, i);}));
	};
	update = function(_height){
		height = _height;
	};
})();