(function(){
	var size, pixelSize, numberOfPixels, scaleX, scaleY, maxIterations;
	var escapeStep = function(x, y){
		var zrn, zin, zr = 0, zi = 0, cr = x, ci = y, step = 0, modsq = 0;
		while(modsq < 8 && step++ < maxIterations){
			zrn = zr * zr - zi * zi + cr;
			zin = 2 * zr * zi + ci;
			zr = zrn;
			zi = zin;
			modsq = zr * zr + zi * zi;
		}
		return {modsq:modsq, step:step};
	};
	var mod2 = function(h1){
		while(h1 >= 2){
			h1 -= 2;
		}
		return h1;
	};
	var hslToRgba = function(h, s, l){
		while(h > 2 * Math.PI){
			h -= 2 * Math.PI;
		}
		var chroma = s * (1 - Math.abs(2 * l - 1));
		var h1 = 3 * h / Math.PI;
		var x = chroma * (1 - Math.abs(mod2(h1) - 1));
		var r1, g1, b1;
		if(h1 < 1){
			r1 = chroma;
			g1 = x;
			b1 = 0;
		}else if(h1 < 2){
			r1 = x;
			g1 = chroma;
			b1 = 0;
		}else if(h1 < 3){
			r1 = 0;
			g1 = chroma;
			b1 = x;
		}else if(h1 < 4){
			r1 = 0;
			g1 = x;
			b1 = chroma;
		}else if(h1 < 5){
			r1 = x;
			g1 = 0;
			b1 = chroma;
		}else{
			r1 = chroma;
			g1 = 0;
			b1 = x;
		}
		var m = l - chroma / 2;
		var r = (r1 + m) * 255;
		var g = (g1 + m) * 255;
		var b = (b1 + m) * 255;
		return {r: r, g: g, b: b, a: 255};
	};

	var log2 = Math.log(2);
	var getRgba = function(x, y){
		var st = escapeStep(x, y);
		var normalizedStep = st.step + 1 - Math.log(Math.log(st.modsq) / (2 * log2)) / log2;
		var hue = Math.PI * normalizedStep / 90;
		var lightness = st.modsq < 4 ? 0 : 0.5 * (1 + Math.sin(normalizedStep / 20));
		return hslToRgba(hue, 0.5, lightness);
	};
	var drawPixelWithColor = function(array, x, y, rgba){
		var left = x * pixelSize;
		var top = y * size * pixelSize;
		for(var yy = 0; yy < pixelSize; yy++){
			for(var xx=0; xx < pixelSize; xx++){
				var index = (top + yy * size + left + xx) * 4;
				array[index] = rgba.r;
				array[index + 1] = rgba.g;
				array[index + 2] = rgba.b;
				array[index + 3] = rgba.a;
			}
		}
	};
	process = function(req, res){
		var origX = req.origX, origY = req.origY;
		var array = new Uint8ClampedArray(4 * size * size);
		for(var tileY = 0;tileY < numberOfPixels; tileY+=1){
			for(var tileX = 0; tileX < numberOfPixels; tileX+=1){
				var realX = origX + (tileX + 0.5) * pixelSize * scaleX;
				var realY = origY + (tileY + 0.5) * pixelSize * scaleY;
				var rgba = getRgba(realX, realY);
				drawPixelWithColor(array, tileX, tileY, rgba);
			}
		}
		res.result = array.buffer;
		res.transferable = [array.buffer];
	};

	update = function(_size, _pixelSize, _scaleX, _scaleY, _maxIterations){
		size = _size;
		pixelSize = _pixelSize;
		numberOfPixels = size / pixelSize;
		scaleX = _scaleX;
		scaleY = _scaleY;
		maxIterations = _maxIterations;
	};
})();