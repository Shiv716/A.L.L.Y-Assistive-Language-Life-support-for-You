"""
Live Backend - Real-time WebSocket server with ElevenLabs Conversational AI
Provides true bidirectional voice communication for the Vesta companion.
"""

import os
import base64
import asyncio
import json
import logging
from typing import Dict, Optional
import signal
import threading
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

from elevenlabs.client import ElevenLabs
from elevenlabs.conversational_ai.conversation import Conversation
from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface

# Load environment variables
load_dotenv()

# Configuration
class Config:
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    AGENT_ID = os.getenv("AGENT_ID") 
    HOST = os.getenv("HOST", "localhost")
    PORT = int(os.getenv("PORT", "8001"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
    # Output sample rate for audio chunks passed to the frontend (PCM16)
    OUTPUT_SAMPLE_RATE_HZ = int(os.getenv("ELEVENLABS_OUTPUT_SAMPLE_RATE", "24000"))

config = Config()

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Vesta Live Backend",
    description="Real-time WebSocket server with ElevenLabs Conversational AI",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Audio Interface for ElevenLabs
class WebSocketAudioInterface:
    """Custom audio interface that routes audio through WebSocket instead of system audio"""
    
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.is_recording = False
        self.audio_queue = asyncio.Queue()
        self.input_callback = None
        # Capture the loop that owns the websocket to schedule thread-safe sends
        try:
            self.loop = asyncio.get_event_loop()
        except RuntimeError:
            self.loop = None
        
    def start(self, input_callback):
        """Start audio interface - required by ElevenLabs SDK"""
        self.input_callback = input_callback
        self.is_recording = True
        logger.info("Started WebSocket audio interface")
        
    def stop(self):
        """Stop audio interface - required by ElevenLabs SDK"""
        self.is_recording = False
        logger.info("Stopped WebSocket audio interface")
    
    def output(self, audio_data: bytes):
        """Deliver agent audio back to the browser via WebSocket as base64."""
        try:
            if not self.loop:
                self.loop = asyncio.get_event_loop()
            payload = {
                "type": "audio",
                "audio_data": base64.b64encode(audio_data).decode("ascii"),
                "encoding": "pcm16",
                "sample_rate_hz": config.OUTPUT_SAMPLE_RATE_HZ
            }
            # Schedule the send on the event loop that owns the websocket
            fut = asyncio.run_coroutine_threadsafe(self.websocket.send_json(payload), self.loop)
            # Avoid blocking too long; best-effort
            try:
                fut.result(timeout=2.0)
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Error forwarding audio to WebSocket: {e}")
        
    async def start_listening(self):
        """Start listening for audio input through WebSocket"""
        self.is_recording = True
        logger.info("Started WebSocket audio listening")
    
    async def stop_listening(self):
        """Stop listening for audio input"""
        self.is_recording = False
        logger.info("Stopped WebSocket audio listening")
    
    async def send_audio(self, audio_data: bytes):
        """Send audio data to the frontend via WebSocket"""
        try:
            await self.websocket.send_bytes(audio_data)
            logger.debug(f"Sent {len(audio_data)} bytes of audio to WebSocket")
        except Exception as e:
            logger.error(f"Error sending audio through WebSocket: {e}")
    
    async def receive_audio(self) -> bytes:
        """Receive audio data from WebSocket"""
        try:
            audio_data = await self.audio_queue.get()
            return audio_data
        except Exception as e:
            logger.error(f"Error receiving audio from WebSocket: {e}")
            return b""
    
    async def queue_audio(self, audio_data: bytes):
        """Queue audio data received from WebSocket"""
        await self.audio_queue.put(audio_data)
        
        # Forward audio to ElevenLabs if callback is set
        if self.input_callback and self.is_recording:
            try:
                self.input_callback(audio_data)
            except Exception as e:
                logger.error(f"Error in input callback: {e}")

# Active conversations management
class ConversationManager:
    def __init__(self):
        self.conversations: Dict[str, Dict] = {}
        self.elevenlabs_client = None
        
        if config.ELEVENLABS_API_KEY:
            self.elevenlabs_client = ElevenLabs(api_key=config.ELEVENLABS_API_KEY)
        else:
            logger.warning("⚠️  ElevenLabs API key not configured!")
    
    async def create_conversation(self, websocket: WebSocket, user_id: Optional[str] = None) -> str:
        """Create a new conversation session"""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{id(websocket)}"
        
        if not self.elevenlabs_client or not config.AGENT_ID:
            raise HTTPException(status_code=500, detail="ElevenLabs not properly configured")
        
        # Create custom audio interface for WebSocket
        audio_interface = WebSocketAudioInterface(websocket)
        
        # Create conversation with ElevenLabs
        conversation = Conversation(
            self.elevenlabs_client,
            config.AGENT_ID,
            requires_auth=bool(config.ELEVENLABS_API_KEY),
            audio_interface=audio_interface,
            
            # Callbacks for logging and WebSocket communication
            callback_agent_response=lambda response: self._on_agent_response(session_id, response),
            callback_agent_response_correction=lambda original, corrected: self._on_agent_correction(session_id, original, corrected),
            callback_user_transcript=lambda transcript: self._on_user_transcript(session_id, transcript),
        )
        
        # Store conversation data
        self.conversations[session_id] = {
            "conversation": conversation,
            "websocket": websocket,
            "audio_interface": audio_interface,
            "user_id": user_id,
            "created_at": datetime.now(),
            "is_active": False
        }
        
        logger.info(f"Created conversation session: {session_id}")
        return session_id
    
    async def start_conversation(self, session_id: str, user_id: Optional[str] = None):
        """Start the ElevenLabs conversation"""
        if session_id not in self.conversations:
            raise HTTPException(status_code=404, detail="Session not found")
        
        conv_data = self.conversations[session_id]
        conversation = conv_data["conversation"]
        
        try:
            # Start the ElevenLabs conversation in a separate thread
            def start_session():
                # Try without user_id first - some SDK versions don't support it
                try:
                    conversation.start_session()
                except Exception as e:
                    logger.error(f"Failed to start session: {e}")
                    raise e
            
            # Run in thread to avoid blocking the async event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, start_session)
            
            conv_data["is_active"] = True
            logger.info(f"Started ElevenLabs conversation for session: {session_id}")
            
        except Exception as e:
            logger.error(f"Error starting conversation: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start conversation: {e}")
    
    async def end_conversation(self, session_id: str):
        """End a conversation session"""
        if session_id in self.conversations:
            conv_data = self.conversations[session_id]
            conversation = conv_data["conversation"]
            
            try:
                # End the ElevenLabs conversation
                conversation.end_session()
                conv_data["is_active"] = False
                
                # Clean up
                del self.conversations[session_id]
                logger.info(f"Ended conversation session: {session_id}")
                
            except Exception as e:
                logger.error(f"Error ending conversation: {e}")
    
    def _on_agent_response(self, session_id: str, response: str):
        """Handle agent response"""
        logger.info(f"[{session_id}] Agent: {response}")
    
    def _on_agent_correction(self, session_id: str, original: str, corrected: str):
        """Handle agent response correction"""
        logger.info(f"[{session_id}] Agent correction: {original} -> {corrected}")
    
    def _on_user_transcript(self, session_id: str, transcript: str):
        """Handle user transcript"""
        logger.info(f"[{session_id}] User: {transcript}")

# Global conversation manager
conversation_manager = ConversationManager()

# Models for API requests
class StartConversationRequest(BaseModel):
    user_id: Optional[str] = None

# API Endpoints
@app.get("/")
async def root():
    """Health check and service information"""
    return {
        "service": "Vesta Live Backend",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "configuration": {
            "elevenlabs_configured": bool(config.ELEVENLABS_API_KEY),
            "agent_id": config.AGENT_ID,
            "active_conversations": len(conversation_manager.conversations)
        },
        "endpoints": {
            "WebSocket": "ws://localhost:8001/ws/conversation",
            "GET /conversations": "List active conversations",
            "GET /health": "Health check"
        }
    }

@app.get("/health")
async def health_check():
    """Simple health check"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/conversations")
async def list_conversations():
    """List all active conversations"""
    conversations = []
    for session_id, conv_data in conversation_manager.conversations.items():
        conversations.append({
            "session_id": session_id,
            "user_id": conv_data.get("user_id"),
            "created_at": conv_data["created_at"].isoformat(),
            "is_active": conv_data["is_active"]
        })
    
    return {
        "count": len(conversations),
        "conversations": conversations
    }

# Additional API endpoints for frontend compatibility
@app.post("/api/save-config")
async def save_config(config_data: dict):
    """Save user configuration (temporary implementation)"""
    # For now, just return success - in production this would save to database
    logger.info(f"Saving config: {config_data}")
    return {"status": "success", "message": "Configuration saved"}

@app.get("/api/get-config")
async def get_config():
    """Get user configuration (temporary implementation)"""
    # Return default config for now
    return {
        "userName": "User",
        "emergencyContact": {
            "name": "Emergency Contact",
            "number": "+1234567890"
        },
        "context": "Default user context",
        "reminders": [],
        "checkInFrequency": 30
    }

@app.post("/api/ask-ai")
async def ask_ai(request: Request):
    """Legacy API endpoint - returns audio blob like the frontend expects"""
    body = await request.json()
    text = body.get("text", "")
    logger.info(f"Legacy API call with text: {text}")
    
    # Generate a simple response
    if text:
        response_text = f"Hello! I heard you say '{text}'. I'm Vesta, your AI companion. How can I help you today?"
    else:
        response_text = "Hello! I'm Vesta, your AI companion. I'm listening - please speak your message."
    
    # Return empty audio blob with transcript in header
    # Frontend expects: audioBlob and transcript in X-Vesta-Transcript header
    empty_audio = b""  # Empty audio for now
    
    return Response(
        content=empty_audio,
        media_type="audio/mpeg",
        headers={
            "X-Vesta-Transcript": response_text,
            "Access-Control-Expose-Headers": "X-Vesta-Transcript"
        }
    )

@app.get("/api/get-scheduled-tasks")
async def get_scheduled_tasks():
    """Get proactive tasks (temporary implementation)"""
    # Return empty tasks for now
    return []

@app.post("/api/test-emergency")
async def test_emergency():
    """Test emergency escalation (temporary implementation)"""
    logger.info("Emergency test triggered")
    return {"status": "success", "message": "Emergency test completed - no real call made"}

@app.get("/api/health")
async def api_health():
    """Health check endpoint for frontend compatibility"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# WebSocket endpoint for real-time communication
@app.websocket("/ws/conversation")
async def websocket_conversation(websocket: WebSocket):
    """Main WebSocket endpoint for real-time conversation"""
    await websocket.accept()
    session_id = None
    
    try:
        logger.info("New WebSocket connection established")
        
        # Create conversation session
        session_id = await conversation_manager.create_conversation(websocket)
        
        # Send session info to client
        await websocket.send_json({
            "type": "session_created",
            "session_id": session_id,
            "message": "Conversation session created. Send 'start' to begin."
        })
        
        # Main communication loop
        while True:
            # Receive messages from frontend
            data = await websocket.receive()
            
            if "text" in data:
                # Handle text messages (control commands)
                message = json.loads(data["text"])
                await handle_websocket_message(session_id, message, websocket)
                
            elif "bytes" in data:
                # Handle audio data from frontend
                audio_data = data["bytes"]
                if session_id in conversation_manager.conversations:
                    conv_data = conversation_manager.conversations[session_id]
                    audio_interface = conv_data["audio_interface"]
                    await audio_interface.queue_audio(audio_data)
                    logger.debug(f"Received {len(audio_data)} bytes of audio from frontend")
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": f"Server error: {str(e)}"
        })
    finally:
        # Clean up conversation
        if session_id:
            await conversation_manager.end_conversation(session_id)

async def handle_websocket_message(session_id: str, message: dict, websocket: WebSocket):
    """Handle text messages from WebSocket"""
    message_type = message.get("type")
    
    if message_type == "start":
        # Start the conversation
        user_id = message.get("user_id")
        try:
            await conversation_manager.start_conversation(session_id, user_id)
            await websocket.send_json({
                "type": "conversation_started",
                "message": "Conversation started! You can now speak."
            })
        except Exception as e:
            await websocket.send_json({
                "type": "error",
                "message": f"Failed to start conversation: {str(e)}"
            })
    
    elif message_type == "stop":
        # Stop the conversation
        await conversation_manager.end_conversation(session_id)
        await websocket.send_json({
            "type": "conversation_stopped",
            "message": "Conversation stopped."
        })
    
    elif message_type == "text":
        # Handle text input (for testing)
        text = message.get("text", "")
        logger.info(f"Received text input: {text}")
        # For now, just echo back - in full implementation this would go through ElevenLabs
        await websocket.send_json({
            "type": "text_response",
            "text": f"Echo: {text}"
        })
    
    else:
        await websocket.send_json({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        })

@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("🎙️  Starting Vesta Live Backend")
    
    # Validate configuration
    if not config.ELEVENLABS_API_KEY:
        logger.warning("⚠️  ElevenLabs API key not configured - set ELEVENLABS_API_KEY")
    
    if not config.AGENT_ID:
        logger.warning("⚠️  Agent ID not configured - set AGENT_ID")
    
    logger.info(f"Server starting on {config.HOST}:{config.PORT}")
    logger.info(f"WebSocket endpoint: ws://{config.HOST}:{config.PORT}/ws/conversation")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Vesta Live Backend")
    
    # End all active conversations
    for session_id in list(conversation_manager.conversations.keys()):
        await conversation_manager.end_conversation(session_id)

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🎙️  VESTA LIVE BACKEND - Real-time Voice Companion")
    print("=" * 70)
    print(f"ElevenLabs API: {'✅ Configured' if config.ELEVENLABS_API_KEY else '❌ Not configured'}")
    print(f"Agent ID: {'✅ Configured' if config.AGENT_ID else '❌ Not configured'}")
    print(f"WebSocket Server: ws://{config.HOST}:{config.PORT}/ws/conversation")
    print(f"REST API: http://{config.HOST}:{config.PORT}")
    print(f"Documentation: http://{config.HOST}:{config.PORT}/docs")
    print("=" * 70 + "\n")
    
    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        log_level=config.LOG_LEVEL.lower()
    )
