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
        
        this.initializeElements();
        this.initializeSpeechRecognition();
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
                this.logMessage('system', `Speech recognition error: ${event.error}`);
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

    async startCompanion() {
        try {
            this.isActive = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.textInput.disabled = false;
            this.sendBtn.disabled = false;

            this.updateStatus('Active - Listening', true);
            this.logMessage('system', 'Vesta companion activated. Listening for voice or text input...');

            // Start speech recognition
            if (this.recognition) {
                this.isListening = true;
                this.recognition.start();
                this.vestaSphere.classList.add('listening');
            }

            // Start polling for proactive tasks
            this.api.startTaskPolling((tasks) => this.handleProactiveTasks(tasks));

            // Initial proactive greeting
            setTimeout(() => {
                if (this.isActive) {
                    this.handleProactiveGreeting();
                }
            }, 2000);

        } catch (error) {
            console.error('Error starting companion:', error);
            this.logMessage('system', 'Error starting companion: ' + error.message);
        }
    }

    stopCompanion() {
        this.isActive = false;
        this.isListening = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.textInput.disabled = true;
        this.sendBtn.disabled = true;

        if (this.recognition) {
            this.recognition.stop();
        }

        this.api.stopTaskPolling();
        this.vestaSphere.classList.remove('listening', 'speaking');
        this.updateStatus('Inactive', false);
        this.logMessage('system', 'Vesta companion deactivated.');
    }

    async handleUserSpeech(transcript) {
        if (!this.isActive) return;

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
            
        } catch (error) {
            console.error('Error playing audio:', error);
            this.vestaSphere.classList.remove('speaking');
            this.vestaSphere.classList.add('listening');
            this.updateStatus('Listening', true);
        }
    }

    async speakText(text) {
        // Fallback text-to-speech using browser API
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            utterance.volume = 0.8;
            
            this.vestaSphere.classList.add('speaking');
            this.updateStatus('Speaking', true);
            
            utterance.onend = () => {
                this.vestaSphere.classList.remove('speaking');
                this.vestaSphere.classList.add('listening');
                this.updateStatus('Listening', true);
            };
            
            speechSynthesis.speak(utterance);
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
            statusDot.classList.remove('inactive');
        } else {
            statusDot.classList.add('inactive');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.vestaCompanion = new VestaCompanion();
});
