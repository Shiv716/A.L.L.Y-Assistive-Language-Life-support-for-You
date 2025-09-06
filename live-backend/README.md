# Vesta Live Backend

Real-time WebSocket server with ElevenLabs Conversational AI for true bidirectional voice communication.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd live-backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `env_template` to `.env` and configure:

```bash
cp env_template .env
```

Edit `.env`:
```
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
AGENT_ID=your_agent_id_here
```

### 3. Run the Server

```bash
python main.py
```

The server will start on `http://localhost:8001` with WebSocket at `ws://localhost:8001/ws/conversation`.

## 🔌 WebSocket API

### Connection

Connect to: `ws://localhost:8001/ws/conversation`

### Message Protocol

**Start Conversation:**
```json
{
  "type": "start",
  "user_id": "optional_user_id"
}
```

**Stop Conversation:**
```json
{
  "type": "stop"
}
```

**Send Text (for testing):**
```json
{
  "type": "text", 
  "text": "Hello, how are you?"
}
```

**Send Audio:**
Send raw audio bytes directly through WebSocket binary message.

### Server Responses

**Session Created:**
```json
{
  "type": "session_created",
  "session_id": "session_20241225_143022_12345",
  "message": "Conversation session created. Send 'start' to begin."
}
```

**Conversation Started:**
```json
{
  "type": "conversation_started", 
  "message": "Conversation started! You can now speak."
}
```

**Audio Response:**
Server sends audio bytes directly as binary WebSocket message.

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

## 🏗️ Architecture

```
Frontend WebSocket ←→ FastAPI WebSocket ←→ ElevenLabs Conversational AI
      ↑                      ↓                        ↓
   Audio In              Audio Routing           Real-time AI
   Audio Out             Session Management      Voice Processing
```

## 📡 REST Endpoints

- `GET /` - Service information and health check
- `GET /health` - Simple health check  
- `GET /conversations` - List active conversations
- `GET /docs` - Interactive API documentation

## 🔧 Configuration Options

All configuration via environment variables:

```bash
# Required
ELEVENLABS_API_KEY=your_api_key
AGENT_ID=your_agent_id

# Optional
HOST=localhost                # Server host
PORT=8001                    # Server port  
LOG_LEVEL=INFO              # Logging level
ALLOWED_ORIGINS=*           # CORS origins
```

## 🎯 Features

- ✅ Real-time WebSocket communication
- ✅ ElevenLabs Conversational AI integration
- ✅ Session management with unique IDs
- ✅ Audio streaming (bidirectional)
- ✅ Conversation logging and callbacks
- ✅ CORS support for frontend integration
- ✅ Health check endpoints
- ✅ Interactive API documentation

## 🔄 A/B Testing

This live backend can be compared against the existing `/backend` solution:

- **Live Backend** (Port 8001): Real-time WebSocket + ElevenLabs
- **Original Backend** (Port 8000): HTTP REST + Manual AI pipeline

## 🐛 Troubleshooting

**WebSocket Connection Issues:**
- Check CORS settings in `ALLOWED_ORIGINS`
- Verify server is running on correct port
- Check browser console for WebSocket errors

**ElevenLabs Integration:**
- Verify API key is correct
- Check Agent ID exists in your ElevenLabs dashboard  
- Monitor server logs for ElevenLabs API errors

**Audio Issues:**
- Ensure audio format is compatible
- Check browser permissions for microphone
- Monitor network for WebSocket disconnections
