/**
 * API Communication Layer for Vesta Frontend
 * Handles all server communication as defined in the API contract
 */

class VestaAPI {
    constructor() {
        this.baseUrl = 'http://localhost:8001'; // Live backend URL (FastAPI + ElevenLabs)
        this.isPolling = false;
        this.pollingInterval = null;
    }

    /**
     * Configuration API - Save user settings
     * POST /api/save-config
     */
    async saveConfig(configData) {
        try {
            const response = await fetch(`${this.baseUrl}/api/save-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(configData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    /**
     * Configuration API - Get current settings
     * GET /api/get-config
     */
    async getConfig() {
        try {
            const response = await fetch(`${this.baseUrl}/api/get-config`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const config = await response.json();
            return config;
        } catch (error) {
            console.error('Error loading config:', error);
            throw error;
        }
    }

    /**
     * Live Conversation API - Send user speech to AI
     * POST /api/ask-ai
     */
    async askAI(userText) {
        try {
            const response = await fetch(`${this.baseUrl}/api/ask-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: userText })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the transcript from custom header
            const transcript = response.headers.get('X-Vesta-Transcript');
            
            // Get the audio blob
            const audioBlob = await response.blob();
            
            return {
                audioBlob,
                transcript
            };
        } catch (error) {
            console.error('Error communicating with AI:', error);
            throw error;
        }
    }

    /**
     * Proactive Tasks API - Check for scheduled tasks
     * GET /api/get-scheduled-tasks
     */
    async getScheduledTasks() {
        try {
            const response = await fetch(`${this.baseUrl}/api/get-scheduled-tasks`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const tasks = await response.json();
            return tasks;
        } catch (error) {
            console.error('Error fetching scheduled tasks:', error);
            return []; // Return empty array on error to avoid breaking polling
        }
    }

    /**
     * Start polling for proactive tasks
     */
    startTaskPolling(callback, intervalMs = 5000) {
        if (this.isPolling) {
            this.stopTaskPolling();
        }

        this.isPolling = true;
        this.pollingInterval = setInterval(async () => {
            try {
                const tasks = await this.getScheduledTasks();
                if (tasks && tasks.length > 0) {
                    callback(tasks);
                }
            } catch (error) {
                console.error('Error in task polling:', error);
            }
        }, intervalMs);

        console.log('Started task polling');
    }

    /**
     * Stop polling for proactive tasks
     */
    stopTaskPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        console.log('Stopped task polling');
    }

    /**
     * Test emergency escalation
     */
    async testEmergency() {
        try {
            const response = await fetch(`${this.baseUrl}/api/test-emergency`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error testing emergency:', error);
            throw error;
        }
    }

    /**
     * Health check - verify backend is running
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            return response.ok;
        } catch (error) {
            console.error('Backend health check failed:', error);
            return false;
        }
    }
}

// Export for use in other modules
window.VestaAPI = VestaAPI;
