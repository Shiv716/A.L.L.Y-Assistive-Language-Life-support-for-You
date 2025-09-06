"""
Production Voice Assistant Backend
Full-featured, configurable, no hardcoded values
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import openai
import requests
import os
import io
import json
import tempfile
import logging
from datetime import datetime
import hashlib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from enum import Enum

# Load environment variables
load_dotenv()


# Configuration class
class Config:
    # API Keys
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

    # OpenAI Settings
    WHISPER_MODEL = os.getenv("WHISPER_MODEL", "whisper-1")
    GPT_MODEL = os.getenv("GPT_MODEL", "gpt-3.5-turbo")
    GPT_MAX_TOKENS = int(os.getenv("GPT_MAX_TOKENS", "150"))
    GPT_TEMPERATURE = float(os.getenv("GPT_TEMPERATURE", "0.7"))

    # ElevenLabs Settings
    ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    ELEVENLABS_MODEL = os.getenv("ELEVENLABS_MODEL", "eleven_monolingual_v1")
    ELEVENLABS_STABILITY = float(os.getenv("ELEVENLABS_STABILITY", "0.75"))
    ELEVENLABS_SIMILARITY = float(os.getenv("ELEVENLABS_SIMILARITY", "0.75"))
    ELEVENLABS_STYLE = float(os.getenv("ELEVENLABS_STYLE", "0.5"))
    ELEVENLABS_BOOST = os.getenv("ELEVENLABS_BOOST", "true").lower() == "true"

    # System Settings
    MAX_HISTORY_LENGTH = int(os.getenv("MAX_HISTORY_LENGTH", "20"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
    PORT = int(os.getenv("PORT", "8000"))
    HOST = os.getenv("HOST", "0.0.0.0")

    # Storage Settings
    SAVE_AUDIO = os.getenv("SAVE_AUDIO", "false").lower() == "true"
    AUDIO_DIR = os.getenv("AUDIO_DIR", "audio_files")
    TRANSCRIPTION_DIR = os.getenv("TRANSCRIPTION_DIR", "transcriptions")

    # System Prompts
    DEFAULT_SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT",
                                      "You are a helpful, friendly assistant. Keep responses concise and conversational.")


config = Config()

# Initialize FastAPI
app = FastAPI(
    title="Voice Assistant API",
    description="Production-ready voice assistant with Whisper and ElevenLabs",
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

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize OpenAI
if config.OPENAI_API_KEY:
    openai.api_key = config.OPENAI_API_KEY
else:
    logger.error("OPENAI_API_KEY not configured!")

# Thread pool for async operations
executor = ThreadPoolExecutor(max_workers=4)

# Create directories if saving files
if config.SAVE_AUDIO:
    os.makedirs(config.AUDIO_DIR, exist_ok=True)
    os.makedirs(config.TRANSCRIPTION_DIR, exist_ok=True)

# Session storage (in production, use Redis or similar)
sessions = {}


# Models
class AudioFormat(str, Enum):
    WAV = "wav"
    MP3 = "mp3"
    WEBM = "webm"
    OGG = "ogg"
    M4A = "m4a"


class VoiceSettings(BaseModel):
    voice_id: Optional[str] = Field(default=None, description="ElevenLabs voice ID")
    stability: Optional[float] = Field(default=None, ge=0, le=1)
    similarity_boost: Optional[float] = Field(default=None, ge=0, le=1)
    style: Optional[float] = Field(default=None, ge=0, le=1)
    use_speaker_boost: Optional[bool] = None


class ProcessTextRequest(BaseModel):
    text: str = Field(..., description="Text to process")
    session_id: Optional[str] = Field(default=None, description="Session ID for conversation history")
    system_prompt: Optional[str] = Field(default=None, description="Custom system prompt")
    voice_settings: Optional[VoiceSettings] = None
    return_audio: bool = Field(default=True, description="Return audio response")
    stream_audio: bool = Field(default=False, description="Stream audio response")


class ProcessVoiceRequest(BaseModel):
    session_id: Optional[str] = Field(default=None)
    language: Optional[str] = Field(default="en", description="Language code for transcription")
    system_prompt: Optional[str] = None
    voice_settings: Optional[VoiceSettings] = None


class TranscriptionResponse(BaseModel):
    timestamp: datetime
    session_id: str
    user_text: str
    assistant_text: str
    audio_saved: bool
    processing_time_ms: float


# Session Management
class SessionManager:
    @staticmethod
    def get_or_create_session(session_id: Optional[str] = None) -> str:
        if not session_id:
            session_id = hashlib.md5(str(datetime.now()).encode()).hexdigest()

        if session_id not in sessions:
            sessions[session_id] = {
                "history": [],
                "created_at": datetime.now(),
                "last_activity": datetime.now()
            }
        else:
            sessions[session_id]["last_activity"] = datetime.now()

        return session_id

    @staticmethod
    def add_to_history(session_id: str, role: str, content: str):
        if session_id in sessions:
            sessions[session_id]["history"].append({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat()
            })

            # Limit history length
            if len(sessions[session_id]["history"]) > config.MAX_HISTORY_LENGTH * 2:
                sessions[session_id]["history"] = sessions[session_id]["history"][-config.MAX_HISTORY_LENGTH:]

    @staticmethod
    def get_history(session_id: str) -> List[Dict]:
        if session_id in sessions:
            return sessions[session_id]["history"]
        return []


# Core Functions
class VoiceAssistant:
    @staticmethod
    async def transcribe_audio(audio_data: bytes, language: str = "en") -> str:
        """Transcribe audio using OpenAI Whisper"""
        try:
            start_time = datetime.now()
            logger.info(f"Starting transcription (language: {language})")

            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file.write(audio_data)
                tmp_file_path = tmp_file.name

            # Transcribe with Whisper
            with open(tmp_file_path, "rb") as audio_file:
                transcript = await asyncio.get_event_loop().run_in_executor(
                    executor,
                    lambda: openai.Audio.transcribe(
                        model=config.WHISPER_MODEL,
                        file=audio_file,
                        language=language if language != "auto" else None
                    )
                )

            # Clean up
            os.unlink(tmp_file_path)

            text = transcript.get("text", "").strip()
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Transcription completed in {duration:.2f}s: {text[:100]}...")

            return text

        except Exception as e:
            logger.error(f"Transcription error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    @staticmethod
    async def generate_response(
            text: str,
            session_id: str,
            system_prompt: Optional[str] = None
    ) -> str:
        """Generate response using OpenAI GPT"""
        try:
            start_time = datetime.now()
            logger.info(f"Generating response for session {session_id}")

            # Build messages
            messages = []

            # System prompt
            prompt = system_prompt or config.DEFAULT_SYSTEM_PROMPT
            messages.append({"role": "system", "content": prompt})

            # Add conversation history
            history = SessionManager.get_history(session_id)
            for entry in history[-config.MAX_HISTORY_LENGTH:]:
                messages.append({
                    "role": entry["role"],
                    "content": entry["content"]
                })

            # Add current message
            messages.append({"role": "user", "content": text})

            # Generate response
            response = await asyncio.get_event_loop().run_in_executor(
                executor,
                lambda: openai.ChatCompletion.create(
                    model=config.GPT_MODEL,
                    messages=messages,
                    max_tokens=config.GPT_MAX_TOKENS,
                    temperature=config.GPT_TEMPERATURE,
                    stream=False
                )
            )

            assistant_text = response.choices[0].message.content.strip()
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Response generated in {duration:.2f}s")

            # Update history
            SessionManager.add_to_history(session_id, "user", text)
            SessionManager.add_to_history(session_id, "assistant", assistant_text)

            return assistant_text

        except Exception as e:
            logger.error(f"Response generation error: {str(e)}")
            # Return a helpful error message instead of failing
            return "I apologize, I'm having trouble processing that request. Please try again."

    @staticmethod
    async def text_to_speech(
            text: str,
            voice_settings: Optional[VoiceSettings] = None
    ) -> bytes:
        """Convert text to speech using ElevenLabs"""
        try:
            start_time = datetime.now()
            logger.info("Starting text-to-speech conversion")

            # Use provided settings or defaults
            voice_id = voice_settings.voice_id if voice_settings and voice_settings.voice_id else config.ELEVENLABS_VOICE_ID

            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

            headers = {
                "xi-api-key": config.ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
            }

            # Build voice settings
            settings = {
                "stability": config.ELEVENLABS_STABILITY,
                "similarity_boost": config.ELEVENLABS_SIMILARITY,
                "style": config.ELEVENLABS_STYLE,
                "use_speaker_boost": config.ELEVENLABS_BOOST
            }

            # Override with provided settings
            if voice_settings:
                if voice_settings.stability is not None:
                    settings["stability"] = voice_settings.stability
                if voice_settings.similarity_boost is not None:
                    settings["similarity_boost"] = voice_settings.similarity_boost
                if voice_settings.style is not None:
                    settings["style"] = voice_settings.style
                if voice_settings.use_speaker_boost is not None:
                    settings["use_speaker_boost"] = voice_settings.use_speaker_boost

            data = {
                "text": text,
                "model_id": config.ELEVENLABS_MODEL,
                "voice_settings": settings
            }

            # Make request
            response = await asyncio.get_event_loop().run_in_executor(
                executor,
                lambda: requests.post(url, json=data, headers=headers)
            )

            if response.status_code == 200:
                duration = (datetime.now() - start_time).total_seconds()
                logger.info(f"Speech generated in {duration:.2f}s, size: {len(response.content)} bytes")
                return response.content
            else:
                logger.error(f"ElevenLabs error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Speech synthesis failed: {response.status_code}"
                )

        except Exception as e:
            logger.error(f"TTS error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")

    @staticmethod
    def save_audio(audio_data: bytes, session_id: str, prefix: str = "response") -> str:
        """Save audio to file if configured"""
        if config.SAVE_AUDIO:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{prefix}_{session_id}_{timestamp}.mp3"
            filepath = os.path.join(config.AUDIO_DIR, filename)

            with open(filepath, "wb") as f:
                f.write(audio_data)

            logger.info(f"Audio saved: {filepath}")
            return filepath
        return ""


# API Endpoints
@app.get("/")
async def root():
    """Health check and API information"""
    return {
        "service": "Voice Assistant API",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "configuration": {
            "openai": {
                "configured": bool(config.OPENAI_API_KEY),
                "whisper_model": config.WHISPER_MODEL,
                "gpt_model": config.GPT_MODEL
            },
            "elevenlabs": {
                "configured": bool(config.ELEVENLABS_API_KEY),
                "voice_id": config.ELEVENLABS_VOICE_ID,
                "model": config.ELEVENLABS_MODEL
            },
            "features": {
                "save_audio": config.SAVE_AUDIO,
                "max_history": config.MAX_HISTORY_LENGTH,
                "active_sessions": len(sessions)
            }
        },
        "endpoints": {
            "POST /process-voice": "Process audio input",
            "POST /process-text": "Process text input",
            "GET /sessions": "List active sessions",
            "GET /session/{session_id}": "Get session details",
            "DELETE /session/{session_id}": "Clear session",
            "GET /voices": "List available voices",
            "GET /models": "List available models"
        }
    }


@app.post("/process-voice", response_model=TranscriptionResponse)
async def process_voice(
        audio: UploadFile = File(..., description="Audio file to process"),
        session_id: Optional[str] = Form(None),
        language: Optional[str] = Form("en"),
        system_prompt: Optional[str] = Form(None),
        voice_id: Optional[str] = Form(None),
        return_audio: bool = Form(True)
):
    """Process voice input: transcribe, generate response, return speech"""
    start_time = datetime.now()

    try:
        # Get or create session
        session_id = SessionManager.get_or_create_session(session_id)
        logger.info(f"Processing voice for session {session_id}")

        # Read audio data
        audio_data = await audio.read()
        logger.info(f"Received audio: {audio.filename}, size: {len(audio_data)} bytes")

        # Save input audio if configured
        if config.SAVE_AUDIO:
            input_path = VoiceAssistant.save_audio(audio_data, session_id, "input")

        # Transcribe
        user_text = await VoiceAssistant.transcribe_audio(audio_data, language)

        if not user_text:
            raise HTTPException(status_code=400, detail="No speech detected in audio")

        # Generate response
        assistant_text = await VoiceAssistant.generate_response(
            user_text, session_id, system_prompt
        )

        # Generate speech if requested
        audio_response = None
        audio_saved = False

        if return_audio:
            voice_settings = VoiceSettings(voice_id=voice_id) if voice_id else None
            audio_response = await VoiceAssistant.text_to_speech(
                assistant_text, voice_settings
            )

            # Save response audio
            if config.SAVE_AUDIO and audio_response:
                VoiceAssistant.save_audio(audio_response, session_id, "response")
                audio_saved = True

        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        # Save transcription if configured
        if config.SAVE_AUDIO:
            transcription_file = os.path.join(
                config.TRANSCRIPTION_DIR,
                f"transcript_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            )
            with open(transcription_file, "w") as f:
                json.dump({
                    "timestamp": datetime.now().isoformat(),
                    "session_id": session_id,
                    "user_text": user_text,
                    "assistant_text": assistant_text,
                    "processing_time_ms": processing_time
                }, f, indent=2)

        # Return audio with metadata
        if audio_response:
            return Response(
                content=audio_response,
                media_type="audio/mpeg",
                headers={
                    "X-Session-ID": session_id,
                    "X-User-Text": user_text,
                    "X-Assistant-Text": assistant_text,
                    "X-Processing-Time-MS": str(processing_time)
                }
            )
        else:
            return JSONResponse({
                "timestamp": datetime.now(),
                "session_id": session_id,
                "user_text": user_text,
                "assistant_text": assistant_text,
                "audio_saved": audio_saved,
                "processing_time_ms": processing_time
            })

    except Exception as e:
        logger.error(f"Process voice error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-text")
async def process_text(request: ProcessTextRequest):
    """Process text input and return audio response"""
    start_time = datetime.now()

    try:
        # Get or create session
        session_id = SessionManager.get_or_create_session(request.session_id)
        logger.info(f"Processing text for session {session_id}: {request.text[:100]}...")

        # Generate response
        assistant_text = await VoiceAssistant.generate_response(
            request.text, session_id, request.system_prompt
        )

        # Generate speech if requested
        if request.return_audio:
            audio_response = await VoiceAssistant.text_to_speech(
                assistant_text, request.voice_settings
            )

            # Save if configured
            if config.SAVE_AUDIO:
                VoiceAssistant.save_audio(audio_response, session_id)

            # Stream or return normally
            if request.stream_audio:
                return StreamingResponse(
                    io.BytesIO(audio_response),
                    media_type="audio/mpeg",
                    headers={
                        "X-Session-ID": session_id,
                        "X-Assistant-Text": assistant_text
                    }
                )
            else:
                return Response(
                    content=audio_response,
                    media_type="audio/mpeg",
                    headers={
                        "X-Session-ID": session_id,
                        "X-Assistant-Text": assistant_text
                    }
                )
        else:
            # Return text only
            return JSONResponse({
                "session_id": session_id,
                "assistant_text": assistant_text,
                "processing_time_ms": (datetime.now() - start_time).total_seconds() * 1000
            })

    except Exception as e:
        logger.error(f"Process text error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions")
async def get_sessions():
    """Get all active sessions"""
    return {
        "count": len(sessions),
        "sessions": [
            {
                "session_id": sid,
                "created_at": data["created_at"].isoformat(),
                "last_activity": data["last_activity"].isoformat(),
                "message_count": len(data["history"])
            }
            for sid, data in sessions.items()
        ]
    }


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details including history"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    return {
        "session_id": session_id,
        "created_at": session["created_at"].isoformat(),
        "last_activity": session["last_activity"].isoformat(),
        "history": session["history"]
    }


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear a specific session"""
    if session_id in sessions:
        del sessions[session_id]
        return {"message": f"Session {session_id} cleared"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")


@app.get("/voices")
async def get_voices():
    """Get available ElevenLabs voices"""
    try:
        headers = {"xi-api-key": config.ELEVENLABS_API_KEY}
        response = requests.get("https://api.elevenlabs.io/v1/voices", headers=headers)

        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Failed to fetch voices: {response.status_code}"}

    except Exception as e:
        return {"error": str(e)}


@app.get("/models")
async def get_models():
    """Get available models"""
    return {
        "whisper": {
            "current": config.WHISPER_MODEL,
            "available": ["whisper-1"]
        },
        "gpt": {
            "current": config.GPT_MODEL,
            "available": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo-preview"]
        },
        "elevenlabs": {
            "current": config.ELEVENLABS_MODEL,
            "available": ["eleven_monolingual_v1", "eleven_multilingual_v2"]
        }
    }


@app.get("/elevenlabs/conversation/{conversation_id}")
async def get_elevenlabs_conversation(conversation_id: str):
    """Fetch conversation transcript from ElevenLabs API"""
    try:
        if not config.ELEVENLABS_API_KEY:
            raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
        
        headers = {
            "xi-api-key": config.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        }
        
        # Make request to ElevenLabs API
        url = f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}"
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            conversation_data = response.json()
            
            # Extract and format transcript
            transcript = conversation_data.get('transcript', [])
            formatted_transcript = []
            
            for entry in transcript:
                formatted_transcript.append({
                    "role": entry.get('role', 'unknown'),
                    "message": entry.get('message', ''),
                    "timestamp": entry.get('time_in_call_secs', 0)
                })
            
            return {
                "success": True,
                "conversation_id": conversation_id,
                "status": conversation_data.get('status', 'unknown'),
                "transcript": formatted_transcript,
                "agent_id": conversation_data.get('agent_id', '')
            }
        else:
            logger.error(f"ElevenLabs API error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"ElevenLabs API error: {response.text}"
            )
            
    except requests.RequestException as e:
        logger.error(f"Request error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")
    except Exception as e:
        logger.error(f"Error fetching conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(e)}")


@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("Starting Voice Assistant API")

    # Validate configuration
    if not config.OPENAI_API_KEY:
        logger.warning("⚠️  OpenAI API key not configured - transcription and GPT will not work")

    if not config.ELEVENLABS_API_KEY:
        logger.warning("⚠️  ElevenLabs API key not configured - speech synthesis will not work")

    logger.info(f"Configuration loaded: {config.MAX_HISTORY_LENGTH} message history, "
                f"save_audio={config.SAVE_AUDIO}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Voice Assistant API")

    # Save sessions if needed
    if config.SAVE_AUDIO and sessions:
        sessions_file = os.path.join(config.TRANSCRIPTION_DIR, "sessions_backup.json")
        with open(sessions_file, "w") as f:
            json.dump(
                {sid: {
                    "created_at": data["created_at"].isoformat(),
                    "last_activity": data["last_activity"].isoformat(),
                    "history": data["history"]
                } for sid, data in sessions.items()},
                f, indent=2
            )
        logger.info(f"Sessions saved to {sessions_file}")


if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 70)
    print("🎙️  PRODUCTION VOICE ASSISTANT API")
    print("=" * 70)
    print(f"OpenAI API: {'✅ Configured' if config.OPENAI_API_KEY else '❌ Not configured'}")
    print(f"ElevenLabs API: {'✅ Configured' if config.ELEVENLABS_API_KEY else '❌ Not configured'}")
    print(f"Server: http://{config.HOST}:{config.PORT}")
    print(f"Documentation: http://{config.HOST}:{config.PORT}/docs")
    print(f"Save Audio: {'Yes' if config.SAVE_AUDIO else 'No'}")
    print(f"Max History: {config.MAX_HISTORY_LENGTH} messages")
    print("=" * 70 + "\n")

    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        log_level=config.LOG_LEVEL.lower()
    )