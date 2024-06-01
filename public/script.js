document.getElementById('audiofile').addEventListener('change', loadFile);
document.getElementById('monitor').addEventListener('click', selectMonitor)
document.getElementById('stopButton').addEventListener('click', stopPlayback);
window.addEventListener('resize', resizeCanvases);

const fftSize = 2048;
const normalizationFactor = 128.0; // [0,255] == [-1,1]
const frequencyBarScaling = 2;
const barHeightScale = 4.5;
const xLabelOffset = 30;
const yLabelOffset = 30;
const tickSize = 5;
const stopButton = document.getElementById('stopButton');
const waveformCanvas = document.getElementById('waveform');
const waveformContext = waveformCanvas.getContext('2d');
const fftCanvas = document.getElementById('fft');
const fftContext = fftCanvas.getContext('2d');

let audioContext;
let analyser;
let source;
let data;
let bufferLength;
let mediaStream;
let selectedDeviceId = null;
let isPlaying = false;

resizeCanvases();

function loadFile(event) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let file = event.target.files[0];
    let fileReader = new FileReader();
    fileReader.onload = function() {
        audioContext.decodeAudioData(fileReader.result, function(buffer) {
            source = audioContext.createBufferSource();
            source.buffer = buffer;
            startAnalyzing(true);
            source.start(0);
        }, function(error) {
            console.error('Error decoding audio data: ', error);
        });
    };
    fileReader.readAsArrayBuffer(file);
}

async function selectMonitor() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = document.getElementById('inputDevices');
        inputs.innerHTML = ''; // Clear existing options
        const hint = document.createElement('option');
        hint.value = null;
        hint.text = "Select input...";
        inputs.appendChild(hint);
        devices.forEach(function(device) {
            if (device.kind === 'audioinput') {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Input ${inputs.length + 1}`;
                inputs.appendChild(option);
            }
        });
        inputs.style.display = 'inline';
        inputs.addEventListener('change', function() {
            selectedDeviceId = this.value;
            startMonitoring();
        });
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
}

function startMonitoring() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined } }).then(function(stream) {
        mediaStream = stream;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaStreamSource(stream);
        startAnalyzing(false);
    }).catch(function(error) {
        console.error('Error accessing audio input device: ', error);
    });
}

function setupAnalyser() {
    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    bufferLength = analyser.frequencyBinCount;
    data = new Uint8Array(bufferLength);
}

function connectAnalyser(outputAudio) {
    source.connect(analyser);
    if (outputAudio) {
        analyser.connect(audioContext.destination);
    }
}

function startAnalyzing(outputAudio) {
    setupAnalyser();
    connectAnalyser(outputAudio);
    isPlaying = true;
    stopButton.disabled = false;
    drawWaveform();
    drawFFT();
}

function stopPlayback() {
    if (isPlaying) {
        isPlaying = false;
        stopButton.disabled = true;
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        } else {
            source.stop();
        }
    }
}

function resizeCanvases() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const paddingTB = 60
    const paddingLR = 20
    waveformCanvas.width = width - paddingLR;
    waveformCanvas.height = (height / 2) - paddingTB;
    fftCanvas.width = width - paddingLR;
    fftCanvas.height = (height / 2) - paddingTB;
}

function drawWaveform() {
    if (!isPlaying) return;
    requestAnimationFrame(drawWaveform);
    analyser.getByteTimeDomainData(data);
    waveformContext.fillStyle = 'black';
    waveformContext.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    waveformContext.lineWidth = 2;
    waveformContext.strokeStyle = 'orange';
    waveformContext.beginPath();
    const sliceWidth = waveformCanvas.width * 1.0 / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / normalizationFactor;
        const y = v * waveformCanvas.height / 2;
        if (i === 0) {
            waveformContext.moveTo(x, y);
        } else {
            waveformContext.lineTo(x, y);
        }
        x += sliceWidth;
    }
    waveformContext.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
    waveformContext.stroke();
    drawWaveformAxis();
}

function drawFFT() {
    if (!isPlaying) return;
    requestAnimationFrame(drawFFT);
    analyser.getByteFrequencyData(data);
    fftContext.fillStyle = 'black';
    fftContext.fillRect(0, 0, fftCanvas.width, fftCanvas.height);
    const barWidth = (fftCanvas.width / bufferLength) * frequencyBarScaling;
    let barHeight;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        barHeight = data[i] * barHeightScale;
        const gradient = fftContext.createLinearGradient(0, fftCanvas.height, 0, fftCanvas.height - barHeight / 2);
        gradient.addColorStop(0, 'green');
        gradient.addColorStop(0.5, 'blue');
        gradient.addColorStop(1, 'purple')
        fftContext.fillStyle = gradient;
        fftContext.fillRect(x, fftCanvas.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
    }
    drawFFTAxis();
}


function drawWaveformAxis() {
    waveformCanvas.strokeStyle = "white";
    waveformContext.lineWidth = 1;

    waveformContext.beginPath();
    waveformContext.moveTo(0, waveformCanvas.height - 1);
    waveformContext.lineTo(waveformCanvas.width, waveformCanvas.height - 1);
    waveformContext.stroke();

    waveformContext.beginPath();
    waveformContext.moveTo(0, 0);
    waveformContext.lineTo(0, waveformCanvas.height);
    waveformContext.stroke();

    waveformContext.fillStyle = "white";
    waveformContext.font = '12px Consolas';
    waveformContext.fillText('Time', waveformCanvas.width / 2, waveformCanvas.height - xLabelOffset);
    waveformContext.save();
    waveformContext.translate(10, waveformCanvas.height / 2);
    waveformContext.rotate(-Math.PI / 2);
    waveformContext.fillText('Amplitude', 0, 0);
    waveformContext.restore();

    const xTick = waveformCanvas.width / 10;
    for (let i = 1; i <= 10; i++) {
        const x = i * xTick;
        waveformContext.beginPath();
        waveformContext.moveTo(x, waveformCanvas.height - tickSize);
        waveformContext.lineTo(x, waveformCanvas.height + tickSize);
        waveformContext.stroke();
        waveformContext.fillText((i * 0.1).toFixed(1), x - tickSize, waveformCanvas.height - tickSize);
    }

    const yTick = waveformCanvas.height / 4;
    for (let i = 1; i <= 4; i++) {
        const y = i * yTick;
        waveformContext.beginPath();
        waveformContext.moveTo(-tickSize, y);
        waveformContext.lineTo(tickSize, y);
        waveformContext.stroke();
        waveformContext.fillText((1 - (i * 0.5)).toFixed(1), yLabelOffset, y - tickSize * 2);
    }
}

function drawFFTAxis() {
    fftContext.strokeStyle = 'white';
    fftContext.lineWidth = 1;

    fftContext.beginPath();
    fftContext.moveTo(0, fftCanvas.height - 1);
    fftContext.lineTo(fftCanvas.width, fftCanvas.height - 1);
    fftContext.stroke();

    fftContext.beginPath();
    fftContext.moveTo(0, 0);
    fftContext.lineTo(0, fftCanvas.height);
    fftContext.stroke();

    fftContext.fillStyle = 'white';
    fftContext.font = '12px Consolas';
    fftContext.fillText('Frequency', fftCanvas.width / 2, fftCanvas.height - xLabelOffset);
    fftContext.save();
    fftContext.translate(10, fftCanvas.height / 2);
    fftContext.rotate(-Math.PI / 2);
    fftContext.fillText('Magnitude', 0, 0);
    fftContext.restore();

    const xTick = fftCanvas.width / 10;
    for (let i = 1; i <= 10; i++) {
        const x = i * xTick;
        fftContext.beginPath();
        fftContext.moveTo(x, fftCanvas.height - tickSize);
        fftContext.lineTo(x, fftCanvas.height + tickSize);
        fftContext.stroke();
        fftContext.fillText((i * (analyser.context.sampleRate / 2 / 10)).toFixed(0), x - tickSize, fftCanvas.height - tickSize);
    }

    const yTick = fftCanvas.height / 4;
    for (let i = 1; i <= 4; i++) {
        const y = i * yTick;
        fftContext.beginPath();
        fftContext.moveTo(-tickSize, y);
        fftContext.lineTo(tickSize, y);
        fftContext.stroke();
        fftContext.fillText((1 - (i * 0.25)).toFixed(2), yLabelOffset, y - tickSize * 2);
    }
}

