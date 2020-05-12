(function(){
	var sliceWidth, coordsMinX, coordsMinY, coordsMaxX, coordsMaxY, width, height;
	var pointWidth;
	var getCoordsX = function(x){
		return coordsMinX + (coordsMaxX - coordsMinX) * x / width;
	};
	var getRealY = function(y){
		return Math.floor(height * (coordsMaxY - y) / (coordsMaxY - coordsMinY));
	};
	var getArrayIndexForPoint = function(x, y){
		return 4 * sliceWidth * y + 4 * x;
	};
	var colorPoint = function(x, y, array){
		if(x >= 0 && x < sliceWidth && y >= 0 && y < height){
			var index = getArrayIndexForPoint(x, y);
			array[index + 3] += pointWidth;
		}
	};
	var displayValue = function(value, x, array){
		var realY = getRealY(value);
		colorPoint(x, realY, array);
	};
	var drawPointsForX = function(sliceStart, x, array){
		var coordsX = getCoordsX(sliceStart + x);
		var value = 0.1;
		var counter = 0;
		while(counter < 40000){
			if(counter > 5000){
				displayValue(value, x, array);
			}
			value = coordsX * value * (1 - value);
			counter++;
		}
	};
	process = function(req, res){
		var array = new Uint8ClampedArray(4 * sliceWidth * height);
		for(var x = 0; x < sliceWidth; x++){
			drawPointsForX(req.x, x, array);
		}
		res.result = array.buffer;
		res.transferable = [array.buffer];
	};
	update = function(_sliceWidth, _coordsMinX, _coordsMinY, _coordsMaxX, _coordsMaxY, _width, _height){
		sliceWidth = _sliceWidth;
		coordsMinX = _coordsMinX;
		coordsMinY = _coordsMinY;
		coordsMaxX = _coordsMaxX;
		coordsMaxY = _coordsMaxY;
		width = _width;
		height = _height;
		pointWidth = 5;
	};
})();