/**
 * Main application logic for Vesta Live Companion UI
 */

class VestaCompanion {
    constructor() {
        this.api = new VestaAPI();
        this.isActive = false;
        this.isListening = false;
        this.recognition = null;
        this.audioPlayer = document.getElementById('audioPlayer');
        this.vestaSphere = document.getElementById('vestaSphere');
        this.conversationLog = document.getElementById('conversationLog');
        
        // WebSocket for ElevenLabs real-time conversation
        this.websocket = null;
        this.isWebSocketConnected = false;
        this.isElevenLabsActive = false;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.audioChunks = [];
        this.audioStream = null;

        // Delayed start config (agent greets after 10s)
        this.startDelayMs = 10000;
        this.countdownInterval = null;
        this.countdownEndAt = null;
        
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeVoices();
        this.checkBackendHealth();
    }

    initializeElements() {
        // Button references
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.emergencyBtn = document.getElementById('emergencyBtn');
        this.clearLogBtn = document.getElementById('clearLogBtn');
        this.sendBtn = document.getElementById('sendBtn');
        this.textInput = document.getElementById('textInput');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');

        // Event listeners
        this.startBtn.addEventListener('click', () => this.startCompanion());
        this.stopBtn.addEventListener('click', () => this.stopCompanion());
        this.emergencyBtn.addEventListener('click', () => this.testEmergency());
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
        this.sendBtn.addEventListener('click', () => this.sendTextMessage());
        
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });
    }

    async checkBackendHealth() {
        const isHealthy = await this.api.healthCheck();
        if (!isHealthy) {
            this.logMessage('system', 'Warning: Backend server not responding. Please start the Flask server.');
            this.updateStatus('Backend Offline', false);
        }
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.trim();
                this.handleUserSpeech(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    this.logMessage('system', 'Microphone access denied. Please allow microphone access and reload the page, or use text input instead.');
                    this.updateStatus('Microphone Denied', false);
                } else if (event.error === 'no-speech') {
                    this.logMessage('system', 'No speech detected. Try speaking closer to the microphone.');
                } else {
                this.logMessage('system', `Speech recognition error: ${event.error}`);
                }
            };

            this.recognition.onend = () => {
                if (this.isActive && this.isListening) {
                    // Restart recognition if still active
                    setTimeout(() => {
                        if (this.isActive) {
                            this.recognition.start();
                        }
                    }, 100);
                }
            };
        } else {
            this.logMessage('system', 'Speech recognition not supported in this browser. Use text input instead.');
        }
    }

    initializeVoices() {
        // Initialize voices for better TTS quality
        if ('speechSynthesis' in window) {
            // Load voices (some browsers need this)
            speechSynthesis.getVoices();
            
            // Listen for voices changed event (some browsers load voices asynchronously)
            speechSynthesis.onvoiceschanged = () => {
                const voices = speechSynthesis.getVoices();
                console.log(`Loaded ${voices.length} voices:`, voices.map(v => v.name));
            };
            
            this.logMessage('system', 'Voice synthesis initialized');
        }
    }

    async startCompanion() {
        try {
            this.isActive = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.textInput.disabled = false;
            this.sendBtn.disabled = false;

            this.updateStatus('Connecting to ElevenLabs...', true);
            this.logMessage('system', 'Preparing ElevenLabs real-time conversation...');

            // Initialize WebSocket connection to ElevenLabs backend
            await this.connectWebSocket();

            // Request microphone access for real-time audio streaming
            try {
                this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
                
                await this.initializeAudioRecording();
                this.logMessage('system', 'Microphone access granted.');
                this.updateStatus('🎙️ Live Conversation Arming...', true);
                this.vestaSphere.classList.add('listening');
                
            } catch (permissionError) {
                console.warn('Microphone permission denied:', permissionError);
                this.logMessage('system', 'Microphone access denied. WebSocket text mode available.');
                this.updateStatus('WebSocket Text Mode', true);
            }

            // Schedule ElevenLabs agent to start after 10 seconds (with countdown)
            this.scheduleAgentAutoStart();

        } catch (error) {
            console.error('Error starting companion:', error);
            this.logMessage('system', 'Error starting companion: ' + error.message);
            this.updateStatus('Connection Failed', false);
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    stopCompanion() {
        this.isActive = false;
        this.isListening = false;
        this.isElevenLabsActive = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.textInput.disabled = true;
        this.sendBtn.disabled = true;

        // Stop legacy speech recognition if running
        if (this.recognition) {
            this.recognition.stop();
        }

        // Clean up WebSocket connection
        this.disconnectWebSocket();

        // Clean up audio recording
        this.stopAudioRecording();

        // Clear any pending countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
            this.countdownEndAt = null;
        }

        this.api.stopTaskPolling();
        this.vestaSphere.classList.remove('listening', 'speaking');
        this.updateStatus('Inactive', false);
        this.logMessage('system', 'ElevenLabs conversation ended.');
    }

    async handleUserSpeech(transcript) {
        if (!this.isActive) return;

        // Filter out empty or very short transcripts
        if (!transcript || transcript.trim().length < 2) {
            console.log('Ignoring empty or very short transcript:', transcript);
            return;
        }

        this.logMessage('user', transcript);
        
        try {
            // Check for emergency keywords
            if (this.containsEmergencyKeywords(transcript)) {
                await this.handleEmergency(transcript);
                return;
            }

            // Send to AI for response
            const response = await this.api.askAI(transcript);
            await this.playVestaResponse(response.audioBlob, response.transcript);

        } catch (error) {
            console.error('Error handling user speech:', error);
            this.logMessage('system', 'Error processing speech: ' + error.message);
        }
    }

    async sendTextMessage() {
        const text = this.textInput.value.trim();
        if (!text || !this.isActive) return;

        this.textInput.value = '';
        await this.handleUserSpeech(text);
    }

    async handleProactiveTasks(tasks) {
        for (const task of tasks) {
            if (task.type === 'speak') {
                this.logMessage('vesta', `[Proactive] ${task.transcript}`);
                
                try {
                    // For demo purposes, we'll synthesize the speech locally
                    // In full implementation, this would come from the backend
                    await this.speakText(task.transcript);
                } catch (error) {
                    console.error('Error with proactive task:', error);
                }
            }
        }
    }

    async handleProactiveGreeting() {
        const greetings = [
            "Hello! I'm Vesta, your AI companion. I'm here to chat and keep you company.",
            "Good day! How are you feeling today?",
            "Hello there! Is there anything I can help you with or would you like to have a chat?"
        ];
        
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        this.logMessage('vesta', `[Proactive] ${greeting}`);
        await this.speakText(greeting);
    }

    async playVestaResponse(audioBlob, transcript) {
        this.logMessage('vesta', transcript);
        
        try {
            // Check if we have actual audio data
            if (audioBlob && audioBlob.size > 0) {
            const audioUrl = URL.createObjectURL(audioBlob);
            this.audioPlayer.src = audioUrl;
            
            this.vestaSphere.classList.add('speaking');
            this.updateStatus('Speaking', true);
            
            await this.audioPlayer.play();
            
            this.audioPlayer.onended = () => {
                this.vestaSphere.classList.remove('speaking');
                this.vestaSphere.classList.add('listening');
                this.updateStatus('Listening', true);
                URL.revokeObjectURL(audioUrl);
            };
            } else {
                // No audio data, use text-to-speech fallback
                console.log('No audio data received, using text-to-speech fallback');
                await this.speakText(transcript);
            }
            
        } catch (error) {
            console.error('Error playing audio:', error);
            // Fallback to text-to-speech
            await this.speakText(transcript);
        }
    }

    async speakText(text) {
        // Enhanced text-to-speech using browser API with better voice selection
        if ('speechSynthesis' in window) {
            // Get available voices and pick the best one
            const voices = speechSynthesis.getVoices();
            let selectedVoice = null;
            
            // Prefer high-quality voices (order of preference)
            const preferredVoices = [
                'Samantha', 'Alex', 'Victoria', 'Karen', 'Daniel', 'Fiona', 'Moira',
                'Google US English', 'Microsoft Zira', 'Microsoft David',
                'en-US', 'en-GB', 'en-AU'
            ];
            
            // Find the best available voice
            for (const preferred of preferredVoices) {
                selectedVoice = voices.find(voice => 
                    voice.name.includes(preferred) || 
                    voice.lang.includes(preferred) ||
                    voice.voiceURI.includes(preferred)
                );
                if (selectedVoice) break;
            }
            
            // Fallback to first English voice if no preferred voice found
            if (!selectedVoice) {
                selectedVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Optimize speech parameters for natural sound
            utterance.voice = selectedVoice;
            utterance.rate = 1.0;        // Normal speed (was 0.9 - too slow)
            utterance.pitch = 1.0;       // Natural pitch (was 1.1 - too high)
            utterance.volume = 0.9;      // Slightly louder
            
            // Add slight pause for more natural delivery
            if (text.length > 50) {
                utterance.rate = 0.95;   // Slightly slower for longer texts
            }
            
            this.vestaSphere.classList.add('speaking');
            this.updateStatus('Speaking', true);
            
            utterance.onend = () => {
                this.vestaSphere.classList.remove('speaking');
                this.vestaSphere.classList.add('listening');
                this.updateStatus('Listening', true);
            };
            
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                this.vestaSphere.classList.remove('speaking');
                this.vestaSphere.classList.add('listening');
                this.updateStatus('Listening', true);
            };
            
            // Cancel any ongoing speech before starting new one
            speechSynthesis.cancel();
            
            // Small delay to ensure cancellation is processed
            setTimeout(() => {
            speechSynthesis.speak(utterance);
            }, 50);
            
            console.log(`Speaking with voice: ${selectedVoice ? selectedVoice.name : 'default'}`);
        }
    }

    containsEmergencyKeywords(text) {
        const keywords = ['help', 'emergency', 'call doctor', 'call ambulance', 'pain', 'cant breathe', 'fallen', 'dizzy'];
        return keywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    async handleEmergency(userText) {
        this.logMessage('emergency', `EMERGENCY DETECTED: ${userText}`);
        this.logMessage('emergency', 'Escalating to emergency contact...');
        
        try {
            const result = await this.api.testEmergency();
            this.logMessage('emergency', `Emergency call initiated: ${result.message}`);
            
            const emergencyResponse = "I understand this is an emergency. I'm calling your emergency contact right now. Help is on the way.";
            this.logMessage('vesta', emergencyResponse);
            await this.speakText(emergencyResponse);
            
        } catch (error) {
            console.error('Emergency escalation failed:', error);
            this.logMessage('emergency', 'Emergency escalation failed: ' + error.message);
        }
    }

    async testEmergency() {
        this.logMessage('system', 'Testing emergency escalation...');
        
        try {
            const result = await this.api.testEmergency();
            this.logMessage('emergency', `Emergency test completed: ${result.message}`);
        } catch (error) {
            console.error('Emergency test failed:', error);
            this.logMessage('system', 'Emergency test failed: ' + error.message);
        }
    }

    logMessage(type, message) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'message';
        messageSpan.textContent = message;
        
        logEntry.appendChild(timestamp);
        logEntry.appendChild(messageSpan);
        
        this.conversationLog.appendChild(logEntry);
        this.conversationLog.scrollTop = this.conversationLog.scrollHeight;
    }

    clearLog() {
        this.conversationLog.innerHTML = '';
        this.logMessage('system', 'Conversation log cleared.');
    }

    updateStatus(text, isActive) {
        this.statusText.textContent = text;
        const statusDot = this.statusIndicator.querySelector('.status-dot');
        
        if (isActive) {
            statusDot.classList.add('active');
            statusDot.classList.remove('inactive');
        } else {
            statusDot.classList.add('inactive');
            statusDot.classList.remove('active');
        }
    }

    // ========== WebSocket Methods for ElevenLabs Real-time Conversation ==========

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `ws://localhost:8001/ws/conversation`;
                this.websocket = new WebSocket(wsUrl);

                this.websocket.onopen = () => {
                    console.log('🔗 WebSocket connected to ElevenLabs backend');
                    this.isWebSocketConnected = true;
                    this.logMessage('system', 'Connected to ElevenLabs WebSocket');
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    this.handleWebSocketMessage(event);
                };

                this.websocket.onclose = (event) => {
                    console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                    this.isWebSocketConnected = false;
                    this.isElevenLabsActive = false;
                    this.logMessage('system', 'WebSocket connection closed');
                    
                    if (this.isActive) {
                        this.updateStatus('Connection Lost', false);
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.logMessage('system', 'WebSocket connection error');
                    reject(new Error('WebSocket connection failed'));
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    disconnectWebSocket() {
        if (this.websocket) {
            // Send stop message before closing
            if (this.isWebSocketConnected) {
                this.websocket.send(JSON.stringify({
                    type: 'stop'
                }));
            }
            
            this.websocket.close();
            this.websocket = null;
            this.isWebSocketConnected = false;
            this.isElevenLabsActive = false;
            console.log('🔌 WebSocket disconnected');
        }
    }

    startElevenLabsConversation() {
        if (this.websocket && this.isWebSocketConnected) {
            this.websocket.send(JSON.stringify({
                type: 'start',
                user_id: 'web_user_' + Date.now()
            }));
            console.log('🎙️ Starting ElevenLabs conversation...');
            this.logMessage('system', 'Starting ElevenLabs conversation...');
        }
    }

    scheduleAgentAutoStart() {
        // Set end time and show countdown
        this.countdownEndAt = Date.now() + this.startDelayMs;
        const render = () => {
            if (!this.isActive) return;
            const remainingMs = Math.max(0, this.countdownEndAt - Date.now());
            const seconds = Math.ceil(remainingMs / 1000);
            this.updateStatus(`Agent will speak in ${seconds}s`, true);
            if (remainingMs <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                this.countdownEndAt = null;
                // Kick off ElevenLabs conversation
                this.startElevenLabsConversation();
            }
        };
        // Initial render and interval
        render();
        this.countdownInterval = setInterval(render, 250);
        this.logMessage('system', `Agent will initiate in ${this.startDelayMs / 1000} seconds...`);
    }

    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message:', data);

            switch (data.type) {
                case 'session_created':
                    this.logMessage('system', '✅ Session created successfully');
                    console.log('Session created:', data);
                    break;

                case 'conversation_started':
                    this.isElevenLabsActive = true;
                    this.logMessage('system', '🎉 ElevenLabs conversation started! You can now speak.');
                    this.updateStatus('🎙️ ElevenLabs Active - Speak Now!', true);
                    this.vestaSphere.classList.add('listening');
                    break;

                case 'conversation_ended':
                    this.isElevenLabsActive = false;
                    this.logMessage('system', 'ElevenLabs conversation ended');
                    this.updateStatus('Conversation Ended', false);
                    break;

                case 'agent_response':
                    if (data.transcript) {
                        this.logMessage('assistant', data.transcript);
                    }
                    break;

                case 'user_transcript':
                    if (data.transcript) {
                        this.logMessage('user', data.transcript);
                    }
                    break;

                case 'error':
                    console.error('WebSocket error message:', data.message);
                    this.logMessage('system', `Error: ${data.message}`);
                    break;

                case 'audio':
                    // Handle incoming audio from ElevenLabs
                    if (data.audio_data) {
                        const sr = Number(data.sample_rate_hz) || 24000;
                        this.playElevenLabsAudio(data.audio_data, sr);
                    }
                    break;

                default:
                    console.log('Unknown WebSocket message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    async initializeAudioRecording() {
        try {
            // Initialize AudioContext for processing
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            // Create MediaRecorder for streaming audio
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: 'audio/webm; codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.isWebSocketConnected && this.isElevenLabsActive) {
                    // Send audio data to WebSocket
                    this.websocket.send(event.data);
                    console.log(`🎤 Sent ${event.data.size} bytes of audio to ElevenLabs`);
                }
            };

            // Start recording and send audio chunks every 100ms for real-time experience
            this.mediaRecorder.start(100);
            console.log('🎤 Real-time audio recording started');

        } catch (error) {
            console.error('Error initializing audio recording:', error);
            throw error;
        }
    }

    stopAudioRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            console.log('🎤 Audio recording stopped');
        }

        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    async playElevenLabsAudio(audioData, sampleRateHint) {
        try {
            // Prefer WebAudio playback for raw PCM data coming from ElevenLabs
            await this.playPcmWithWebAudio(audioData, sampleRateHint || 24000);
        } catch (webaudioError) {
            console.warn('WebAudio playback failed, trying WAV fallback:', webaudioError);
            try {
                const wavBlob = this.buildWavFromPcmBase64(audioData, sampleRateHint || 24000);
                const audioUrl = URL.createObjectURL(wavBlob);
                this.audioPlayer.src = audioUrl;
                
                this.vestaSphere.classList.add('speaking');
                this.updateStatus('🔊 Vesta Speaking', true);
                await this.audioPlayer.play();
                this.audioPlayer.onended = () => {
                    this.vestaSphere.classList.remove('speaking');
                    if (this.isElevenLabsActive) {
                        this.updateStatus('🎙️ ElevenLabs Active - Speak Now!', true);
                    }
                    URL.revokeObjectURL(audioUrl);
                };
            } catch (wavError) {
                console.error('Error playing ElevenLabs audio:', wavError);
                this.vestaSphere.classList.remove('speaking');
            }
        }
    }

    // Decode base64 PCM16 mono and play via WebAudio for widest compatibility
    async playPcmWithWebAudio(base64Pcm, sampleRate) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        const byteArray = Uint8Array.from(atob(base64Pcm), c => c.charCodeAt(0));
        // Interpret as 16-bit little-endian PCM
        const pcmView = new DataView(byteArray.buffer);
        const numSamples = Math.floor(byteArray.byteLength / 2);
        const float32 = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            const s = pcmView.getInt16(i * 2, true); // little-endian
            float32[i] = Math.max(-1, Math.min(1, s / 32768));
        }
        const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        audioBuffer.getChannelData(0).set(float32);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        this.vestaSphere.classList.add('speaking');
        this.updateStatus('🔊 Vesta Speaking', true);

        await new Promise((resolve) => {
            source.onended = () => {
                this.vestaSphere.classList.remove('speaking');
                if (this.isElevenLabsActive) {
                    this.updateStatus('🎙️ ElevenLabs Active - Speak Now!', true);
                }
                resolve();
            };
            source.start();
        });
    }

    // Build a minimal WAV container from PCM16 mono data so <audio> can play it
    buildWavFromPcmBase64(base64Pcm, sampleRate) {
        const pcmBytes = Uint8Array.from(atob(base64Pcm), c => c.charCodeAt(0));
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
        const blockAlign = (numChannels * bitsPerSample) / 8;
        const dataSize = pcmBytes.byteLength;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        let offset = 0;

        // RIFF header
        function writeString(str) {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset++, str.charCodeAt(i));
            }
        }
        function writeUint32(val) { view.setUint32(offset, val, true); offset += 4; }
        function writeUint16(val) { view.setUint16(offset, val, true); offset += 2; }

        writeString('RIFF');
        writeUint32(36 + dataSize);
        writeString('WAVE');
        writeString('fmt ');
        writeUint32(16);              // Subchunk1Size (PCM)
        writeUint16(1);               // AudioFormat (PCM)
        writeUint16(numChannels);
        writeUint32(sampleRate);
        writeUint32(byteRate);
        writeUint16(blockAlign);
        writeUint16(bitsPerSample);
        writeString('data');
        writeUint32(dataSize);

        // PCM data
        new Uint8Array(buffer, 44).set(pcmBytes);

        return new Blob([buffer], { type: 'audio/wav' });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.vestaCompanion = new VestaCompanion();
});
