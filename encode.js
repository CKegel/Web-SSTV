/*
MIT License

Copyright (c) 2024 Christian Kegel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/
//---------- Encoding Constants ----------//

const PREFIX_PULSE_LENGTH = 0.1;  //100 ms
const HEADER_PULSE_LENGTH = 0.3;  //300 ms
const HEADER_BREAK_LENGTH = 0.01; //10 ms
const VIS_BIT_LENGTH = 0.03;      //30 ms
const SYNC_PULSE_FREQ = 1200;
const BLANKING_PULSE_FREQ = 1500;
const COLOR_FREQ_MULT = 3.1372549;
const VIS_BIT_FREQ = {
	ONE: 1100,
	ZERO: 1300,
};

class Format {

	#numScanLines;
	#vertResolution;
	#blankingInterval;
	#scanLineLength;
	#syncPulseLength;
	#VISCode;
	#preparedImage = [];

	constructor(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode) {
		this.#numScanLines = numScanLines;
		this.#vertResolution = vertResolution;
		this.#blankingInterval = blankingInterval;
		this.#scanLineLength = scanLineLength;
		this.#syncPulseLength = syncPulseLength;
		this.#VISCode = VISCode;
	}

	getGreyscaleFreq(data, scanLine, vertPos) {
		const index = scanLine * (this.#vertResolution * 4) + vertPos * 4;
		let grey = data[index] * 0.299 + 0.587 * data[index + 1] + 0.114 * data[index + 2]
		return grey * COLOR_FREQ_MULT + 1500
	}

	getRGBValueAsFreq(data, scanLine, vertPos) {
		const index = scanLine * (this.#vertResolution * 4) + vertPos * 4;
		let red = data[index] * COLOR_FREQ_MULT + 1500;
		let green = data[index + 1] * COLOR_FREQ_MULT + 1500;
		let blue = data[index + 2] * COLOR_FREQ_MULT + 1500;
		return [red, green, blue];
	}

	getYRYBYValueAsFreq(data, scanLine, vertPos) {
		const index = scanLine * (this.#vertResolution * 4) + vertPos * 4;
		let red = data[index];
		let green = data[index + 1];
		let blue = data[index + 2];

		let Y = 6.0 + (.003906 * ((65.738 * red) + (129.057 * green) + (25.064 * blue)));
		let RY = 128.0 + (.003906 * ((112.439 * red) + (-94.154 * green) + (-18.285 * blue)));
		let BY = 128.0 + (.003906 * ((-37.945 * red) + (-74.494 * green) + (112.439 * blue)));
		return [1500 + Y * COLOR_FREQ_MULT , 1500 + RY * COLOR_FREQ_MULT, 1500 + BY * COLOR_FREQ_MULT];
	}

	encodePrefix(oscillator, startTime) {
		let time = startTime;

		oscillator.frequency.setValueAtTime(1900, time);
		time += PREFIX_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(1500, time);
		time += PREFIX_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(1900, time);
		time += PREFIX_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(1500, time);
		time += PREFIX_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(2300, time);
		time += PREFIX_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(1500, time);
		time += PREFIX_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(2300, time);
		time += PREFIX_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(1500, time);
		time += PREFIX_PULSE_LENGTH;

		return time;
	}

	encodeHeader(oscillator, startTime) {
		let time = startTime;

		//----- Format Header -----//
		oscillator.frequency.setValueAtTime(1900, time);
		time += HEADER_PULSE_LENGTH;
		oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
		time  += HEADER_BREAK_LENGTH;
		oscillator.frequency.setValueAtTime(1900, time);
		time += HEADER_PULSE_LENGTH;

		//-----VIS Code-----//
		//--- Start Bit ---//
		oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
		time += VIS_BIT_LENGTH;
		//--- 7 Bit Format Code ---//
		let parity = 0;
		let bitFreq;
		this.#VISCode.reverse().forEach((bit) => {
			if(bit){
				bitFreq = VIS_BIT_FREQ.ONE;
				++parity;
			}
			else
				bitFreq = VIS_BIT_FREQ.ZERO;
			oscillator.frequency.setValueAtTime(bitFreq, time)
			time += VIS_BIT_LENGTH;
		});
		//--- Even Parity Bit ---//
		bitFreq = parity % 2 == 0 ? VIS_BIT_FREQ.ZERO : VIS_BIT_FREQ.ONE;
		oscillator.frequency.setValueAtTime(bitFreq, time)
		time += VIS_BIT_LENGTH;
		//--- End Bit ---//
		oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
		time += VIS_BIT_LENGTH;

		return time;
	}

	prepareImage(data) {
		 this.#preparedImage = data;
	}

	encodeSSTV(oscillator, startTime) {
		throw new Error("Must be defined by a subclass");
	}

	getEncodedLength() {
		throw new Error("Must be defined by a subclass");
	}

	get numScanLines() {
		return this.#numScanLines;
	}
	get vertResolution() {
		return this.#vertResolution;
	}
	get blankingInterval() {
		return this.#blankingInterval;
	}
	get scanLineLength() {
		return this.#scanLineLength;
	}
	get syncPulseLength() {
		return this.#syncPulseLength;
	}
	get VISCode() {
		return this.#VISCode;
	}
	get preparedImage(){
		return this.#preparedImage;
	}
}

//---------- Format Encode Implementation ----------//
class MartinBase extends Format {
	prepareImage(data) {
		let preparedImage = [];
		for(let scanLine = 0; scanLine < this.numScanLines; ++scanLine){
			let red = [];
			let green = [];
			let blue = [];
			for(let vertPos = 0; vertPos < this.vertResolution; ++vertPos){
  				let freqs = this.getRGBValueAsFreq(data, scanLine, vertPos);
  				red.push(freqs[0]);
  				green.push(freqs[1]);
  				blue.push(freqs[2]);
  			}
  			preparedImage.push([green, blue, red]);
		}

		super.prepareImage(preparedImage);
	}

	encodeSSTV(oscillator, startTime) {
		let time = startTime;

		time = super.encodePrefix(oscillator, time);
		time = super.encodeHeader(oscillator, time);

		for(let scanLine = 0; scanLine < super.numScanLines; ++scanLine){
			oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
			time += super.syncPulseLength;
			oscillator.frequency.setValueAtTime(BLANKING_PULSE_FREQ, time);
			time += super.blankingInterval;
			for(let dataLine = 0; dataLine < 3; ++dataLine) {
				oscillator.frequency.setValueCurveAtTime(super.preparedImage[scanLine][dataLine], time, super.scanLineLength);
				time += super.scanLineLength;
				oscillator.frequency.setValueAtTime(BLANKING_PULSE_FREQ, time);
				time += super.blankingInterval;
			}
		}

		return time;
	}
	getEncodedLength() {
		return (super.numScanLines * (super.syncPulseLength + super.blankingInterval + 3 * (super.scanLineLength + super.blankingInterval)));
	}
}
class MartinMOne extends MartinBase {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.000572;
		let scanLineLength = 0.146432;
		let syncPulseLength = 0.004862;
		let VISCode = [false, true, false, true, true, false, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class MartinMTwo extends MartinBase {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.000572;
		let scanLineLength = 0.073216;
		let syncPulseLength = 0.004862;
		let VISCode = [false, true, false, true, false, false, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}

class ScottieBase extends Format {
	prepareImage(data) {
		let preparedImage = [];
		for(let scanLine = 0; scanLine < this.numScanLines; ++scanLine){
			let red = [];
			let green = [];
			let blue = [];
			for(let vertPos = 0; vertPos < this.vertResolution; ++vertPos){
  				let freqs = this.getRGBValueAsFreq(data, scanLine, vertPos);
  				red.push(freqs[0]);
  				green.push(freqs[1]);
  				blue.push(freqs[2]);
  			}
  			preparedImage.push([green, blue, red]);
		}

		super.prepareImage(preparedImage);
	}

	encodeSSTV(oscillator, startTime) {
		let time = startTime;

		time = super.encodePrefix(oscillator, time);
		time = super.encodeHeader(oscillator, time);

		oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
		time += super.syncPulseLength;

		for(let scanLine = 0; scanLine < super.numScanLines; ++scanLine){
			for(let dataLine = 0; dataLine < 3; ++dataLine) {
				if(dataLine == 2){
					oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
					time += super.syncPulseLength;
				}
				oscillator.frequency.setValueAtTime(BLANKING_PULSE_FREQ, time);
				time += super.blankingInterval;
				oscillator.frequency.setValueCurveAtTime(super.preparedImage[scanLine][dataLine], time, super.scanLineLength);
				time += super.scanLineLength;
			}
		}

		return time;
	}

	getEncodedLength() {
		return (super.syncPulseLength + (super.numScanLines * (super.syncPulseLength / 2 + super.blankingInterval + super.scanLineLength)));
	}
}
class ScottieOne extends ScottieBase {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.0015;
		let scanLineLength = 0.138240;
		let syncPulseLength = 0.009;
		let VISCode = [false, true, true, true, true, false, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class ScottieTwo extends ScottieBase {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.0015;
		let scanLineLength = 0.088064;
		let syncPulseLength = 0.009;
		let VISCode = [false, true, true, true, false, false, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class ScottieDX extends ScottieBase {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.0015;
		let scanLineLength = 0.3456;
		let syncPulseLength = 0.009;
		let VISCode = [true, false, false, true, true, false, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}

class PDBase extends Format {
	prepareImage(data) {
		let preparedImage = [];
		for(let scanLine = 0; scanLine < this.numScanLines; ++scanLine){
			let Y = [];
			let RY = [];
			let BY = [];
			for(let vertPos = 0; vertPos < this.vertResolution; ++vertPos){
  				let freqs = this.getYRYBYValueAsFreq(data, scanLine, vertPos);
  				Y.push(freqs[0]);
  				RY.push(freqs[1]);
  				BY.push(freqs[2]);
  			}
  			preparedImage.push([Y, RY, BY]);
		}
		for(let scanLine = 0; scanLine < this.numScanLines; scanLine += 2){
			for(let vertPos = 0; vertPos < this.vertResolution; ++vertPos){
				let RY = preparedImage[scanLine][1][vertPos] + preparedImage[scanLine + 1][1][vertPos]
				preparedImage[scanLine][1][vertPos] = RY / 2;
				let BY = preparedImage[scanLine][2][vertPos] + preparedImage[scanLine + 1][2][vertPos]
				preparedImage[scanLine][2][vertPos] = BY / 2;
			}
		}
		super.prepareImage(preparedImage);
	}

	encodeSSTV(oscillator, startTime) {
		let time = startTime;

		time = super.encodePrefix(oscillator, time);
		time = super.encodeHeader(oscillator, time);

		for(let scanLine = 0; scanLine < super.numScanLines; scanLine += 2){
			oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
			time += super.syncPulseLength;
			oscillator.frequency.setValueAtTime(BLANKING_PULSE_FREQ, time);
			time += super.blankingInterval;

			oscillator.frequency.setValueCurveAtTime(super.preparedImage[scanLine][0], time, super.scanLineLength);
			time += super.scanLineLength;
			oscillator.frequency.setValueCurveAtTime(super.preparedImage[scanLine][1], time, super.scanLineLength);
			time += super.scanLineLength;
			oscillator.frequency.setValueCurveAtTime(super.preparedImage[scanLine][2], time, super.scanLineLength);
			time += super.scanLineLength;
			oscillator.frequency.setValueCurveAtTime(super.preparedImage[scanLine + 1][0], time, super.scanLineLength);
			time += super.scanLineLength;
		}

		return time;
	}

	getEncodedLength() {
		return (super.numScanLines * (super.syncPulseLength + super.blankingInterval + super.scanLineLength * 4));
	}
}
class PD50 extends PDBase {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.00208;
		let scanLineLength = 0.091520;
		let syncPulseLength = 0.02;
		let VISCode = [true, false, true, true, true, false, true];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class PD90 extends PDBase {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.00208;
		let scanLineLength = 0.170240;
		let syncPulseLength = 0.02;
		let VISCode = [true, true, false, false, false, true, true];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class PD120 extends PDBase {
	constructor() {
		let numScanLines = 496;
		let vertResolution = 640;
		let blankingInterval = 0.00208;
		let scanLineLength = 0.121600;
		let syncPulseLength = 0.02;
		let VISCode = [true, false, true, true, true, true, true];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class PD160 extends PDBase {
	constructor() {
		let numScanLines = 400;
		let vertResolution = 512;
		let blankingInterval = 0.00208;
		let scanLineLength = 0.195584;
		let syncPulseLength = 0.02;
		let VISCode = [true, true, false, false, true, false, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class PD180 extends PDBase {
	constructor() {
		let numScanLines = 496;
		let vertResolution = 640;
		let blankingInterval = 0.00208;
		let scanLineLength = 0.18304;
		let syncPulseLength = 0.02;
		let VISCode = [true, true, false, false, false, false, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class PD240 extends PDBase {
	constructor() {
		let numScanLines = 496;
		let vertResolution = 640;
		let blankingInterval = 0.00208;
		let scanLineLength = 0.24448;
		let syncPulseLength = 0.02;
		let VISCode = [true, true, false, false, false, false, true];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}
class PD290 extends PDBase {
	constructor() {
		let numScanLines = 616;
		let vertResolution = 800;
		let blankingInterval = 0.00208;
		let scanLineLength = 0.2288;
		let syncPulseLength = 0.02;
		let VISCode = [true, false, true, true, true, true, false];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}

class WraaseSC2 extends Format {
	prepareImage(data) {
		let preparedImage = [];
		for(let scanLine = 0; scanLine < this.numScanLines; ++scanLine){
			let red = [];
			let green = [];
			let blue = [];
			for(let vertPos = 0; vertPos < this.vertResolution; ++vertPos){
  				let freqs = this.getRGBValueAsFreq(data, scanLine, vertPos);
  				red.push(freqs[0]);
  				green.push(freqs[1]);
  				blue.push(freqs[2]);
  			}
  			preparedImage.push([red, green, blue]);
		}

		super.prepareImage(preparedImage);
	}

	encodeSSTV(oscillator, startTime) {
		let time = startTime;

		time = super.encodePrefix(oscillator, time);
		time = super.encodeHeader(oscillator, time);

		for(let scanLine = 0; scanLine < super.numScanLines; ++scanLine){
			oscillator.frequency.setValueAtTime(SYNC_PULSE_FREQ, time);
			time += super.syncPulseLength;
			oscillator.frequency.setValueAtTime(BLANKING_PULSE_FREQ, time);
			time += super.blankingInterval;
			for(let dataLine = 0; dataLine < 3; ++dataLine) {
				oscillator.frequency.setValueCurveAtTime(super.preparedImage[scanLine][dataLine], time, super.scanLineLength);
				time += super.scanLineLength;
			}
		}

		return time;
	}

	getEncodedLength() {
		return (super.numScanLines * (super.syncPulseLength + super.blankingInterval + super.scanLineLength * 3));
	}
}
class WraaseSC2180 extends WraaseSC2 {
	constructor() {
		let numScanLines = 256;
		let vertResolution = 320;
		let blankingInterval = 0.0005;
		let scanLineLength = 0.235;
		let syncPulseLength = 0.0055225;
		let VISCode = [false, true, true, false, true, true, true];

		super(numScanLines, vertResolution, blankingInterval, scanLineLength, syncPulseLength, VISCode);
	}
}

//---------- Frontend Controls ----------//

const audioCtx = new AudioContext();
let imageLoaded = false;

let modeSelect = document.getElementById("modeSelect");
let startButton = document.getElementById("startButton");
let downloadButton = document.getElementById('downloadButton');
let imgPicker = document.getElementById("imgPicker");
let warningText = document.getElementById("warningText");
let callSignEntry = document.getElementById("callSign");
let callSignLocation = document.getElementById("callSignLocation");

let canvas = document.getElementById("imgCanvas");
let canvasCtx = canvas.getContext("2d");
let rawImage = new Image();
let sstvFormat = new Format();

function drawPreview() {
	canvas.width = sstvFormat.vertResolution;
	canvas.height = sstvFormat.numScanLines;
	canvasCtx.drawImage(rawImage,0,0, canvas.width, canvas.height);
	canvasCtx.font = "bold 24pt sans-serif";

	let callSignYCord;
	if(callSignLocation.value == "top-left")
		callSignYCord = 30;
	else if(callSignLocation.value == "bottom-left")
		callSignYCord = sstvFormat.numScanLines - 6;

	canvasCtx.fillText(callSignEntry.value, 10, callSignYCord);
	canvasCtx.strokeStyle = "white";
	canvasCtx.strokeText(callSignEntry.value, 10, callSignYCord);
	imageLoaded = true;
}

callSignEntry.oninput = (e) => {
	if(imageLoaded)
		drawPreview();
}

callSignLocation.addEventListener("change", (e) => {
	if(imageLoaded)
		drawPreview();
});

rawImage.onload = () => { drawPreview() };

imgPicker.addEventListener("change", (e) => {
    var reader = new FileReader();
    reader.onload = function(event){
        rawImage.src = event.target.result;
        if(modeSelect.value != "none"){
			warningText.textContent = "";
			startButton.disabled = false;
			downloadButton.disabled = false;
        }
    }
    reader.readAsDataURL(e.target.files[0]);
});

modeSelect.addEventListener("change", (e) => {
	if(modeSelect.value != "none"){
			warningText.textContent = "";
			startButton.disabled = !imageLoaded;
			downloadButton.disabled = !imageLoaded;
			imgPicker.disabled = false;
        }
	if(modeSelect.value == "M1")
		sstvFormat = new MartinMOne();
	else if(modeSelect.value == "M2")
		sstvFormat = new MartinMTwo();
	else if(modeSelect.value == "S1")
		sstvFormat = new ScottieOne();
	else if(modeSelect.value == "S2")
		sstvFormat = new ScottieTwo();
	else if(modeSelect.value == "SDX")
		sstvFormat = new ScottieDX();
	else if(modeSelect.value == "PD50")
		sstvFormat = new PD50();
	else if(modeSelect.value == "PD90")
		sstvFormat = new PD90();
	else if(modeSelect.value == "PD120")
		sstvFormat = new PD120();
	else if(modeSelect.value == "PD160")
		sstvFormat = new PD160();
	else if(modeSelect.value == "PD180")
		sstvFormat = new PD180();
	else if(modeSelect.value == "PD240")
		sstvFormat = new PD240();
	else if(modeSelect.value == "PD290")
		sstvFormat = new PD290();
	else if(modeSelect.value == "RobotBW8")
		sstvFormat = new RobotBW8();
	else if(modeSelect.value == "WraaseSC2180")
		sstvFormat = new WraaseSC2180();

	if(imageLoaded)
		drawPreview();
});

startButton.onclick = () => {

	if(modeSelect.value == "none") {
		warningText.textContent = "You must select a mode";
		startButton.disabled = true;
		return;
	}

	if(!imageLoaded){
		warningText.textContent = "You must upload an image";
		startButton.disabled = true;
		return;
	}

	let canvasData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);

	warningText.textContent = "";
	if (audioCtx.state === "suspended") {
    	audioCtx.resume();
    }

    let oscillator = audioCtx.createOscillator();
	oscillator.type = "sine";

	oscillator.connect(audioCtx.destination);

	sstvFormat.prepareImage(canvasData.data);
	let startTime = audioCtx.currentTime + 1;
	let endTime = sstvFormat.encodeSSTV(oscillator, audioCtx.currentTime + 1);
	oscillator.start(startTime);
	oscillator.end(endTime);
};

function createWAVHeader(audioLength) {
    const headerSize = 44;
    const header = new ArrayBuffer(headerSize);
    const view = new DataView(header);
    // RIFF chunk
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + audioLength, true); // File size
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, 1, true); // Number of channels (mono)
    view.setUint32(24, 48000, true); // Sample rate
    view.setUint32(28, 48000 * 1 * 16 / 8, true); // Byte rate
    view.setUint16(32, 1 * 16 / 8, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, audioLength, true); // Data size
    
    return header;
}



downloadButton.onclick = () => {

    if (modeSelect.value == "none") {
        warningText.textContent = "You must select a mode";
        startButton.disabled = true;
        return;
    }

    if (!imageLoaded) {
        warningText.textContent = "You must upload an image";
        startButton.disabled = true;
        return;
    }

    let canvasData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);

    warningText.textContent = "";

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    sstvSignalDuration = sstvFormat.getEncodedLength() + 1;
    const offlineCtx = new OfflineAudioContext(1, 48000 * sstvSignalDuration, 48000);
    let oscillator = offlineCtx.createOscillator();
    oscillator.type = "sine";

    oscillator.connect(offlineCtx.destination);

    sstvFormat.prepareImage(canvasData.data);
    endTime = sstvFormat.encodeSSTV(oscillator, 1);
    console.log(endTime - 1);
    oscillator.start(1);

    offlineCtx.startRendering().then((audioBuffer) => {
        const audioData = audioBuffer.getChannelData(0); // Get first audio channel

        // Convert Float32Array to Int16Array
        const audioLength = audioData.length;
        const audioInt16 = new Int16Array(audioLength);
        for (let i = 0; i < audioLength; i++) {
            audioInt16[i] = Math.max(-1, Math.min(1, audioData[i])) * 32767;
        }

        // Convert the audio data to a Blob for download
        const wavHeader = createWAVHeader(audioInt16.length * 2); // 2 bytes per sample
        const wavFile = new Uint8Array(wavHeader.byteLength + audioInt16.byteLength);
        wavFile.set(new Uint8Array(wavHeader), 0);
        wavFile.set(new Uint8Array(audioInt16.buffer), wavHeader.byteLength);

        const blob = new Blob([wavFile], { type: 'audio/wav' });

        // Download the Blob
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sstv_signal.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
};