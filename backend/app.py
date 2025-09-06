"""
Vesta AI Companion - Flask Backend
Handles API endpoints for configuration, AI conversation, and emergency escalation
"""

import os
import json
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tempfile
import threading
from twilio.rest import Client
from twilio.twiml import VoiceResponse
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Configuration file path
CONFIG_FILE = 'config.json'

# Global state for proactive tasks
proactive_tasks = []
last_check_in = None

class VestaBackend:
    def __init__(self):
        self.config = self.load_config()
        self.elevenlabs_api_key = os.getenv('ELEVENLABS_API_KEY')
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        # Initialize Twilio client
        if self.twilio_account_sid and self.twilio_auth_token:
            self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
        else:
            self.twilio_client = None
            print("Warning: Twilio credentials not found. Emergency calling disabled.")

    def load_config(self):
        """Load configuration from JSON file"""
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
        
        # Return default config if file doesn't exist or error occurred
        return {
            "userName": "John",
            "emergencyContact": {
                "name": "Emergency Contact",
                "number": "+1234567890"
            },
            "context": "A friendly person who enjoys conversation.",
            "reminders": [],
            "checkInFrequency": 30
        }

    def save_config(self, config_data):
        """Save configuration to JSON file"""
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config_data, f, indent=2)
            self.config = config_data
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False

    def generate_ai_response(self, user_text):
        """Generate AI response using context and personality"""
        user_name = self.config.get('userName', 'there')
        context = self.config.get('context', '')
        
        # Create a contextual response based on user input and personality
        # In a full implementation, this would use a more sophisticated AI model
        
        responses = {
            'greeting': f"Hello {user_name}! How are you feeling today? I'm here to chat and keep you company.",
            'weather': f"I'd love to chat about the weather with you, {user_name}. What's it like outside today?",
            'pain': f"I'm sorry to hear you're in pain, {user_name}. Can you tell me more about how you're feeling? If it's serious, I can call for help.",
            'lonely': f"I understand that feeling, {user_name}. I'm here with you. Would you like to hear a story or talk about something that makes you happy?",
            'memory': f"That's wonderful, {user_name}. I love hearing your stories. Tell me more about that.",
            'medication': f"Of course, {user_name}. It's important to take your medications on time. Let me know if you need any reminders.",
            'family': f"Family is so important, {user_name}. I'm sure they care about you very much. Would you like to tell me about them?",
            'default': f"That's interesting, {user_name}. I enjoy our conversations. What else would you like to talk about?"
        }
        
        # Simple keyword matching for demo purposes
        user_lower = user_text.lower()
        
        if any(word in user_lower for word in ['hello', 'hi', 'good morning', 'good afternoon']):
            return responses['greeting']
        elif any(word in user_lower for word in ['weather', 'sunny', 'rain', 'cold', 'warm']):
            return responses['weather']
        elif any(word in user_lower for word in ['pain', 'hurt', 'ache', 'sick']):
            return responses['pain']
        elif any(word in user_lower for word in ['lonely', 'alone', 'sad', 'miss']):
            return responses['lonely']
        elif any(word in user_lower for word in ['remember', 'story', 'past', 'when i was']):
            return responses['memory']
        elif any(word in user_lower for word in ['medication', 'pills', 'medicine', 'tablet']):
            return responses['medication']
        elif any(word in user_lower for word in ['family', 'children', 'grandchildren', 'daughter', 'son']):
            return responses['family']
        else:
            return responses['default']

    def text_to_speech(self, text):
        """Convert text to speech using ElevenLabs API"""
        if not self.elevenlabs_api_key:
            print("Warning: ElevenLabs API key not found. Using fallback.")
            return None
        
        try:
            url = "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB"  # Default voice
            
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": self.elevenlabs_api_key
            }
            
            data = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.5
                }
            }
            
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code == 200:
                return response.content
            else:
                print(f"ElevenLabs API error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error with text-to-speech: {e}")
            return None

    def make_emergency_call(self, message="Emergency assistance needed"):
        """Make emergency call using Twilio"""
        if not self.twilio_client:
            return {"success": False, "message": "Twilio not configured"}
        
        try:
            emergency_number = self.config['emergencyContact']['number']
            
            call = self.twilio_client.calls.create(
                url='http://your-domain.ngrok.io/twilio-webhook',  # You'll need to set this up
                to=emergency_number,
                from_=self.twilio_phone_number
            )
            
            return {
                "success": True, 
                "message": f"Emergency call initiated to {emergency_number}",
                "call_sid": call.sid
            }
            
        except Exception as e:
            print(f"Error making emergency call: {e}")
            return {"success": False, "message": str(e)}

# Initialize backend
vesta = VestaBackend()

# API Endpoints

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/save-config', methods=['POST'])
def save_config():
    """Save user configuration"""
    try:
        config_data = request.get_json()
        
        if not config_data:
            return jsonify({"error": "No configuration data provided"}), 400
        
        success = vesta.save_config(config_data)
        
        if success:
            return jsonify({"status": "success"})
        else:
            return jsonify({"error": "Failed to save configuration"}), 500
            
    except Exception as e:
        print(f"Error in save_config: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-config')
def get_config():
    """Get current configuration"""
    try:
        return jsonify(vesta.config)
    except Exception as e:
        print(f"Error in get_config: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ask-ai', methods=['POST'])
def ask_ai():
    """Handle user speech/text and return AI response"""
    try:
        data = request.get_json()
        user_text = data.get('text', '').strip()
        
        if not user_text:
            return jsonify({"error": "No text provided"}), 400
        
        # Generate AI response
        ai_response = vesta.generate_ai_response(user_text)
        
        # Convert to speech
        audio_data = vesta.text_to_speech(ai_response)
        
        if audio_data:
            # Create temporary file for audio
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            # Return audio file with transcript in header
            response = send_file(temp_file_path, mimetype='audio/mpeg')
            response.headers['X-Vesta-Transcript'] = ai_response
            
            # Clean up temp file after response
            threading.Timer(1.0, lambda: os.unlink(temp_file_path)).start()
            
            return response
        else:
            # Fallback: return just the transcript
            return jsonify({"transcript": ai_response, "audio": False})
            
    except Exception as e:
        print(f"Error in ask_ai: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-scheduled-tasks')
def get_scheduled_tasks():
    """Check for proactive tasks (reminders, check-ins)"""
    try:
        global proactive_tasks, last_check_in
        
        current_time = datetime.now()
        tasks = []
        
        # Check for medication reminders
        for reminder in vesta.config.get('reminders', []):
            reminder_time = datetime.strptime(reminder['time'], '%H:%M').time()
            current_time_only = current_time.time()
            
            # Check if reminder time matches (within 1 minute window)
            if (abs((datetime.combine(datetime.today(), current_time_only) - 
                    datetime.combine(datetime.today(), reminder_time)).total_seconds()) < 60):
                
                task = {
                    "type": "speak",
                    "transcript": f"Hello {vesta.config.get('userName', 'there')}! Time for your reminder: {reminder['task']}"
                }
                tasks.append(task)
        
        # Check for proactive check-ins
        check_in_frequency = vesta.config.get('checkInFrequency', 30) * 60  # Convert to seconds
        
        if last_check_in is None or (current_time - last_check_in).total_seconds() > check_in_frequency:
            last_check_in = current_time
            
            check_in_messages = [
                f"Just checking in, {vesta.config.get('userName', 'there')}. How are you doing?",
                f"Hello {vesta.config.get('userName', 'there')}! I wanted to see how you're feeling today.",
                f"Good to see you, {vesta.config.get('userName', 'there')}! Is there anything I can help you with?"
            ]
            
            import random
            message = random.choice(check_in_messages)
            
            task = {
                "type": "speak",
                "transcript": message
            }
            tasks.append(task)
        
        return jsonify(tasks)
        
    except Exception as e:
        print(f"Error in get_scheduled_tasks: {e}")
        return jsonify([])

@app.route('/api/test-emergency', methods=['POST'])
def test_emergency():
    """Test emergency escalation"""
    try:
        result = vesta.make_emergency_call("This is a test emergency call from Vesta AI companion.")
        return jsonify(result)
    except Exception as e:
        print(f"Error in test_emergency: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/twilio-webhook', methods=['POST'])
def twilio_webhook():
    """Twilio webhook for emergency calls"""
    try:
        response = VoiceResponse()
        
        emergency_contact_name = vesta.config['emergencyContact']['name']
        user_name = vesta.config.get('userName', 'your loved one')
        
        message = f"Hello {emergency_contact_name}. This is Vesta, the AI companion for {user_name}. " \
                 f"I am calling because {user_name} has requested emergency assistance. " \
                 f"Please check on them immediately or call emergency services if needed. " \
                 f"This message will repeat once more."
        
        response.say(message, voice='alice', language='en-US')
        response.pause(length=2)
        response.say(message, voice='alice', language='en-US')
        
        return str(response), 200, {'Content-Type': 'text/xml'}
        
    except Exception as e:
        print(f"Error in twilio_webhook: {e}")
        response = VoiceResponse()
        response.say("Emergency call from Vesta AI companion. Please check on your loved one immediately.")
        return str(response), 200, {'Content-Type': 'text/xml'}

if __name__ == '__main__':
    print("Starting Vesta AI Companion Backend...")
    print(f"Configuration loaded for user: {vesta.config.get('userName', 'Unknown')}")
    print("Backend running on http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
