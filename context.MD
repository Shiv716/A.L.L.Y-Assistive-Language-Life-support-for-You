Project Vesta: The AI Care Companion (Hackathon Build)1. The Mission: Building a LifelineWelcome to Project Vesta. This weekend, our goal is to build a prototype that tackles one of the most significant challenges of our time: the loneliness and isolation faced by our elderly loved ones.We are creating a proactive, voice-first AI companion that provides ambient companionship, personalized engagement, and a crucial safety net. Our success will be measured by our ability to build a demo that is not only technically impressive but also deeply moving, showcasing a future where technology fosters connection and provides true peace of mind.This is a 48-hour hackathon project. Speed, focus, and a powerful demo are our primary objectives. We must prioritize features that tell a compelling story.2. Proposed Architecture & Tech StackWe will operate a standard client-server model. The Frontend will run in the browser, handling all user interaction (voice input/output). The Backend will be the brain, managing logic, state, and all external API communications.Our Stack is chosen for speed and power:Frontend:Framework: Vanilla HTML, CSS, JavaScript (ES6). No complex frameworks to keep setup minimal.Wake Word: Picovoice Porcupine (JavaScript SDK) for "always on" listening.Speech-to-Text (STT): Browser's native Web Speech API.Backend:Framework: Python with Flask. It's lightweight and perfect for building APIs quickly.Data Storage: A single config.json file to act as our simple database.Key APIs:Expressive Voice (TTS): ElevenLabs. This is critical for creating Vesta's warm, empathetic personality.Telephony: Twilio. This is our "wow" factor for the emergency call feature.3. Project Directory StructureA clean structure is essential for moving fast and collaborating effectively. We will use two main directories, /frontend and /backend./vesta-hackathon/
├── /frontend/
│   ├── login.html              # Landing/Login page (routes to config)
│   ├── index.html              # The Live Companion UI
│   ├── config.html             # The Setup/Configuration Page
│   ├── /css/
│   │   ├── style.css           # Styling for Live Companion
│   │   └── config.css          # Styling for Config Page
│   ├── /js/
│   │   ├── main.js             # Logic for Live Companion
│   │   ├── config.js           # Logic for Config Page
│   │   └── api.js              # Handles ALL server communication
│   └── /assets/
│       └── wake-word.ppn       # Picovoice wake word model

├── /backend/
│   ├── app.py                  # Main Flask server application
│   ├── config.json             # The "database" for our user settings
│   ├── requirements.txt        # Python dependencies (Flask, Twilio, ElevenLabs)
│   └── .env                    # To store our secret API keys

└── README.md                   # This file4. Collaboration & Code QualityClean Code & Comments: Write code that is easy for your teammate (and the AI agent) to read. Use clear variable names and comment on any complex logic. The goal is clarity, not cleverness.Git Workflow: Use a shared Git repository. Create separate branches for features (feature/frontend-ui, feature/backend-twilio). Commit small, logical changes frequently with clear messages.API-First Approach: The frontend and backend are separate applications that talk to each other. We must strictly adhere to the API contract defined below.5. Demo FlowThe frontend user flow for the hackathon demo is: 1) login.html → 2) config.html → 3) index.html. The login page is a non-functional demo and routes directly to configuration on submit.6. Shared Components & API Contract (CRITICAL COLLABORATION POINT)This is the most important section. The frontend and backend depend entirely on this "contract" being stable.A. The Shared config.json Data ModelThis file is the single source of truth for the companion's settings. Both frontend and backend will interact with it via the API.{
  "userName": "John",
  "emergencyContact": {
    "name": "Sarah",
    "number": "+447911123456"
  },
  "context": "John is a former RAF pilot and loves stories about WW2 spitfires. He can be forgetful.",
  "reminders": [
    {
      "time": "09:00",
      "task": "Take your Amlodipine (heart pills)"
    },
    {
      "time": "20:00",
      "task": "Take your Amlodipine (heart pills)"
    }
  ],
  "checkInFrequency": 30
}
B. The API EndpointsThe backend (app.py) will expose the following endpoints for the frontend (api.js) to use.1. Configuration APIEndpoint: POST /api/save-configPurpose: Saves the user's settings.Request Payload (JSON): The entire config.json structure (see above).Response: 200 OK with { "status": "success" }.Endpoint: GET /api/get-configPurpose: Loads the current settings to populate the config page.Request: No payload needed.Response: The entire config.json structure.2. Live Conversation APIEndpoint: POST /api/ask-aiPurpose: Handles a live request from the user.Request Payload (JSON): { "text": "The user's transcribed speech" }Response: The raw audio file (e.g., MP3) of Vesta's spoken response. The backend will also provide the transcript of what is being said in a custom header for the log.Example Custom Header: X-Vesta-Transcript: "Of course, John. Let me tell you about the Spitfire..."3. Proactive Tasks APIEndpoint: GET /api/get-scheduled-tasksPurpose: The frontend polls this endpoint every few seconds to check for proactive tasks.Request: No payload needed.Response (JSON): If no task, returns an empty []. If a task is ready, it returns:[
  {
    "type": "speak",
    "transcript": "Good morning, John. Just a gentle reminder it's 9am, time for your Amlodipine.",
    "voice_id": "vesta-warm-voice-id" // Optional, for different tones
  }
]
4. Twilio Emergency WebhookEndpoint: POST /twilio-webhookPurpose: This endpoint is for Twilio only. It is not called by our frontend.Request: Twilio sends a standard webhook request.Response: The backend responds with TwiML (XML) to instruct Twilio's call.Let's build something amazing.