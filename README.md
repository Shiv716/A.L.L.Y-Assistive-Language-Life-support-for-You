# A.L.L.Y - Assistive Language Life support for You
## Vesta AI Companion - Hackathon Build

An empathetic AI companion designed to provide ambient companionship and intelligent safety net for elderly people living independently.

## 🎯 Hackathon Demo Features

- **Proactive Companionship**: AI initiates conversations and provides gentle reminders
- **Deep Personalization**: Configured with user's personality, interests, and routines
- **Emergency Escalation**: Intelligent detection and real-world phone call integration
- **Beautiful UI**: Split-screen interface with animated companion sphere
- **Voice Interaction**: Speech recognition and natural voice responses

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Modern web browser with speech recognition support
- ElevenLabs API key (for voice synthesis)
- Twilio account (for emergency calls)

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
cp .env-template .env
# Edit .env with your API keys
python app.py
```

### 2. Frontend Setup

Simply open `frontend/login.html` in a modern web browser, or serve it with a local web server:

```bash
cd frontend
python -m http.server 8000
# Open http://localhost:8000/login.html
```

### 3. Demo Flow

1. **Login**: Start at `login.html` with beautiful UI and brand identity
2. **Configuration**: Set up user information and emergency contact
3. **Live Companion**: Experience the animated sphere and voice interaction
4. **Emergency Test**: Demonstrate real-world phone call capability

## 🏗️ Architecture

### Frontend (`/frontend`)
- **Vanilla HTML/CSS/JS** for maximum compatibility and speed
- **Web Speech API** for voice recognition
- **Minimal monochrome design** with violet brand accents
- **Inter typography** at 28px/24px/20px hierarchy
- **Real-time conversation log** showing all interactions

### Backend (`/backend`)
- **Flask API** with CORS enabled for frontend communication
- **JSON file storage** for configuration (hackathon simplicity)
- **ElevenLabs integration** for expressive voice synthesis
- **Twilio integration** for emergency phone calls

## 📡 API Endpoints

### Configuration
- `POST /api/save-config` - Save user settings
- `GET /api/get-config` - Load current settings

### Live Conversation
- `POST /api/ask-ai` - Send user input, get AI response with audio
- `GET /api/get-scheduled-tasks` - Poll for proactive tasks

### Emergency System
- `POST /api/test-emergency` - Test emergency escalation
- `POST /twilio-webhook` - Twilio webhook for call handling

## 🔧 Development Notes

### Adding ElevenLabs Integration

1. Sign up at [ElevenLabs](https://elevenlabs.io/)
2. Get your API key from the dashboard
3. Add to `.env`: `ELEVENLABS_API_KEY=your_key_here`

### Adding Twilio Integration

1. Create account at [Twilio](https://twilio.com/)
2. Get phone number and API credentials
3. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=your_twilio_number
   ```

### For Emergency Calls in Development

Use ngrok to expose your local webhook:
```bash
ngrok http 5000
# Update webhook URL in app.py with your ngrok URL
```

## 🎬 Demo Script (90 seconds)

1. **Login (15s)**: Show beautiful login page with imagery
2. **Setup (15s)**: Quick configuration with personalization
3. **Proactive Chat (30s)**: Demonstrate AI initiating conversation
4. **User Interaction (15s)**: Show voice/text interaction
5. **Emergency Demo (15s)**: Trigger emergency, show real phone call

## 🎨 Design System

- **Typography**: Inter font with 28px H1, 24px H2, 20px body text
- **Colors**: Monochrome base with violet accents (#61459e, #a78cde)
- **Logo**: Instrument Serif "ALLY" wordmark
- **Layout**: Minimal, professional, trustworthy aesthetic

## 🔮 Future Enhancements

- Wake word detection with Picovoice
- Advanced AI model integration (GPT-4, Claude)
- Health monitoring integrations
- Family dashboard for remote monitoring
- Multi-language support

## 📝 Technical Decisions

- **Vanilla JS**: Fast setup, no build process
- **Flask**: Lightweight, perfect for hackathon APIs
- **JSON config**: Simple persistence without database complexity
- **Browser Speech API**: No additional dependencies
- **ElevenLabs**: High-quality, empathetic voice generation

Built with ❤️ for the hackathon - creating technology that truly cares.
