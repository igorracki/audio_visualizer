document.getElementById('audiofile').addEventListener('change', function(event) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext())
    const file = event.target.files[0]
    const fileReader = new FileReader()
    const fftSize = 2048
    const normalizationFactor = 128.0 // [0,255] == [-1,1]
    const frequencyBarScaling = 3
    const barHeightScale = 5

    fileReader.onload = function() {
        audioContext.decodeAudioData(fileReader.result, function(buffer) {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = fftSize;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            analyser.connect(audioContext.destination);
            source.start(0);

            const waveformCanvas = document.getElementById('waveform');
            const waveformContext = waveformCanvas.getContext('2d');
            const fftCanvas = document.getElementById('fft');
            const fftContext = fftCanvas.getContext('2d');

            function drawWaveform() {
                requestAnimationFrame(drawWaveform);
                analyser.getByteTimeDomainData(dataArray);
                waveformContext.fillStyle = 'black';
                waveformContext.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
                waveformContext.lineWidth = 2;
                waveformContext.strokeStyle = 'orange';
                waveformContext.beginPath();
                const sliceWidth = waveformCanvas.width * 1.0 / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / normalizationFactor;
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
            }

            function drawFFT() {
                requestAnimationFrame(drawFFT);
                analyser.getByteFrequencyData(dataArray);
                fftContext.fillStyle = 'black';
                fftContext.fillRect(0, 0, fftCanvas.width, fftCanvas.height);
                const barWidth = (fftCanvas.width / bufferLength) * frequencyBarScaling;
                let barHeight;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    barHeight = dataArray[i] * barHeightScale;
                    const gradient = fftContext.createLinearGradient(0, fftCanvas.height, 0, fftCanvas.height - barHeight / 2);
                    gradient.addColorStop(0, 'green');
                    gradient.addColorStop(0.5, 'blue');
                    gradient.addColorStop(1, 'purple')
                    fftContext.fillStyle = gradient;
                    fftContext.fillRect(x, fftCanvas.height - barHeight / 2, barWidth, barHeight / 2);
                    x += barWidth + 1;
                }
            }

            function resizeCanvases() {
                const width = window.innerWidth;
                const height = window.innerHeight;
                const padding = 50
                waveformCanvas.width = width - padding;
                waveformCanvas.height = (height / 2) - padding;
                fftCanvas.width = width - padding;
                fftCanvas.height = (height / 2) - padding;
            }

            window.addEventListener('resize', resizeCanvases);
            resizeCanvases()
            drawWaveform();
            drawFFT();
        }, function(error) {
            console.error('Error decoding audio data:', error);
        });
    };

    fileReader.readAsArrayBuffer(file);
})
