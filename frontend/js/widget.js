// ============================================================================
// ELEVENLABS CONVAI WIDGET SETUP - MULTI-AGENT DEMO
// ============================================================================
// 
// DYNAMIC AGENT CONFIGURATION BASED ON URL PARAMETERS
// ============================================================================

// Agent configurations for different demo flows
const AGENT_CONFIGS = {
  'flow1': {
    id: 'agent_7401k4g1r9m7fsh9xpg0a5zn8h1w',
    title: 'Flow 1: energetic good morning',
    description: 'Energetic morning companion to start the day'
  },
  'flow2': {
    id: 'agent_0201k4f0z28heg7t3zs2yw3mqbqv',
    title: 'Flow 2: keeping user mentally engaged',
    description: 'Engaging companion for mental stimulation'
  },
  'flow3': {
    id: 'agent_2801k4hv7keze68tgybjty5qd1v6',
    title: 'Flow 3: reminders of key actions',
    description: 'Helpful reminder companion for daily tasks'
  }
};

// Get flow parameter from URL or default to flow1
function getFlowFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const flow = urlParams.get('flow') || 'flow1';
  console.log(`🔍 URL Search: ${window.location.search}`);
  console.log(`🔍 Flow parameter: ${flow}`);
  return flow;
}

// Get current agent configuration
const currentFlow = getFlowFromURL();
console.log(`🔍 Current flow: ${currentFlow}`);
console.log(`🔍 Available configs:`, Object.keys(AGENT_CONFIGS));

const agentConfig = AGENT_CONFIGS[currentFlow] || AGENT_CONFIGS['flow1'];
const AGENT_ID = agentConfig.id;

// Log current configuration
console.log(`🎯 Loading ${agentConfig.title}`);
console.log(`🤖 Agent ID: ${AGENT_ID}`);
console.log(`🔍 Agent config:`, agentConfig);

// OPTIONAL: Change navigation behavior
const OPEN_IN_NEW_TAB = true; // true = new tab, false = same tab

// OPTIONAL: Change widget position
const WIDGET_POSITION = 'embedded'; // 'bottom-right', 'bottom-left', 'top-right', 'top-left', 'embedded'

// OPTIONAL: Base URL for navigation (leave empty for auto-detection)
const BASE_URL = ''; // e.g., 'https://mysite.framer.app' or 'https://mysite.wixsite.com/mysite'

// ============================================================================
// DON'T CHANGE ANYTHING BELOW THIS LINE
// ============================================================================

// Create and inject the widget with client tools
function injectElevenLabsWidget() {
  const ID = 'elevenlabs-convai-widget';
  
  // Check if the widget is already loaded
  if (document.getElementById(ID)) {
    return;
  }

  // Create widget script
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
  script.async = true;
  script.type = 'text/javascript';
  document.head.appendChild(script);

  // Create wrapper and widget
  const wrapper = document.createElement('div');
  wrapper.className = `convai-widget ${WIDGET_POSITION}`;

  const widget = document.createElement('elevenlabs-convai');
  widget.id = ID;
  widget.setAttribute('agent-id', AGENT_ID);
  widget.setAttribute('variant', 'full');

  // Listen for the widget's "call" event to inject client tools
  widget.addEventListener('elevenlabs-convai:call', (event) => {
    event.detail.config.clientTools = {
      redirectToExternalURL: ({ url }) => {
        console.log('redirectToExternalURL called with url:', url);
        addActivityEntry('FUNCTION', `redirectToExternalURL called with: ${url}`);
        
        // Build full URL - handles any base URL
        let fullUrl = url;
        if (!url.startsWith('http')) {
          // Use custom base URL if provided, otherwise auto-detect
          const baseUrl = BASE_URL || window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
          fullUrl = `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }
        
        console.log('Navigating to:', fullUrl);
        addActivityEntry('NAV', `Navigating to: ${fullUrl}`);
        
        // Navigate based on config
        if (OPEN_IN_NEW_TAB) {
          window.open(fullUrl, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = fullUrl;
        }
      },
    };
  });

  // Listen for conversation events to capture transcript
  widget.addEventListener('elevenlabs-convai:conversation-started', (event) => {
    console.log('🎬 Conversation started:', event.detail);
    addTranscriptEntry('system', 'Conversation started with ElevenLabs AI');
    addActivityEntry('START', 'ElevenLabs conversation initiated');
    updateConnectionStatus(true);
  });

  widget.addEventListener('elevenlabs-convai:conversation-ended', (event) => {
    console.log('🛑 Conversation ended:', event.detail);
    addTranscriptEntry('system', 'Conversation ended');
    addActivityEntry('END', 'ElevenLabs conversation terminated');
    updateConnectionStatus(false);
    
    // Try to fetch full transcript if conversation_id is available
    if (event.detail && event.detail.conversation_id) {
      addActivityEntry('API', `Fetching transcript for conversation ${event.detail.conversation_id}`);
      fetchFullTranscript(event.detail.conversation_id);
    }
  });

  // Real-time transcript events
  widget.addEventListener('elevenlabs-convai:user-spoke', (event) => {
    console.log('🎤 User spoke:', event.detail);
    if (event.detail) {
      const transcript = event.detail.transcript || event.detail.message || event.detail.text;
      if (transcript) {
        addTranscriptEntry('user', transcript);
        addActivityEntry('SPEECH', 'User speech processed');
      }
    }
  });

  widget.addEventListener('elevenlabs-convai:agent-response', (event) => {
    console.log('🤖 Agent response:', event.detail);
    if (event.detail) {
      const transcript = event.detail.transcript || event.detail.message || event.detail.text;
      if (transcript) {
        addTranscriptEntry('vesta', transcript);
        addActivityEntry('RESPONSE', 'AI generated response');
      }
    }
  });

  // Alternative event patterns for different widget versions
  widget.addEventListener('elevenlabs-convai:user-message', (event) => {
    console.log('💬 User message:', event.detail);
    if (event.detail && event.detail.message) {
      addTranscriptEntry('user', event.detail.message);
    }
  });

  widget.addEventListener('elevenlabs-convai:agent-message', (event) => {
    console.log('🗣️ Agent message:', event.detail);
    if (event.detail && event.detail.message) {
      addTranscriptEntry('vesta', event.detail.message);
    }
  });

  widget.addEventListener('elevenlabs-convai:message', (event) => {
    console.log('Widget message:', event.detail);
    if (event.detail && event.detail.type === 'transcript') {
      const { role, message } = event.detail;
      addTranscriptEntry(role === 'user' ? 'user' : 'vesta', message);
    }
  });

  // Additional event listeners for comprehensive transcript capture
  widget.addEventListener('elevenlabs-convai:audio-start', (event) => {
    console.log('Audio started:', event.detail);
    addTranscriptEntry('system', 'User started speaking');
    addActivityEntry('AUDIO', 'Audio input detected');
  });

  widget.addEventListener('elevenlabs-convai:audio-end', (event) => {
    console.log('Audio ended:', event.detail);
    addTranscriptEntry('system', 'User stopped speaking');
    addActivityEntry('AUDIO', 'Audio input ended');
  });

  widget.addEventListener('elevenlabs-convai:transcript', (event) => {
    console.log('Transcript event:', event.detail);
    if (event.detail) {
      const role = event.detail.role === 'user' ? 'user' : 'vesta';
      addTranscriptEntry(role, event.detail.message || event.detail.text || event.detail.content);
    }
  });

  // Catch-all for any other events we might have missed
  ['elevenlabs-convai:status', 'elevenlabs-convai:error', 'elevenlabs-convai:state-change'].forEach(eventType => {
    widget.addEventListener(eventType, (event) => {
      console.log(`${eventType}:`, event.detail);
      if (event.detail && event.detail.message) {
        addTranscriptEntry('system', `${eventType.replace('elevenlabs-convai:', '')}: ${event.detail.message}`);
      }
    });
  });

  // Debug: Listen for ALL events starting with 'elevenlabs-convai'
  const originalAddEventListener = widget.addEventListener;
  widget.addEventListener = function(eventType, handler, options) {
    if (eventType.startsWith('elevenlabs-convai')) {
      console.log(`🔍 Registering listener for: ${eventType}`);
    }
    return originalAddEventListener.call(this, eventType, handler, options);
  };

  // Add a global event listener to catch any ElevenLabs events we might have missed
  window.addEventListener('message', (event) => {
    if (event.data && typeof event.data === 'object') {
      const eventData = event.data;
      if (eventData.type && eventData.type.includes('elevenlabs')) {
        console.log('🌍 Global ElevenLabs event detected:', eventData);
        if (eventData.transcript || eventData.message) {
          const message = eventData.transcript || eventData.message;
          const role = eventData.role || 'system';
          addTranscriptEntry(role === 'user' ? 'user' : 'vesta', message);
        }
      }
    }
  });

  // Attach widget to the DOM
  wrapper.appendChild(widget);
  
  // Check if we have a specific container for embedded mode
  const targetContainer = document.getElementById('elevenlabs-widget-container');
  if (WIDGET_POSITION === 'embedded' && targetContainer) {
    // Hide loading message
    const loadingElement = document.getElementById('widget-loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    targetContainer.appendChild(wrapper);
  } else {
    document.body.appendChild(wrapper);
  }
}

// Helper function to add transcript entries to the conversation log
function addTranscriptEntry(role, message) {
  const conversationLog = document.getElementById('conversationLog');
  if (!conversationLog) return;

  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${role}`;
  
  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();
  
  const messageElement = document.createElement('span');
  messageElement.className = 'message';
  messageElement.textContent = message;
  
  logEntry.appendChild(timestamp);
  logEntry.appendChild(messageElement);
  conversationLog.appendChild(logEntry);
  
  // Auto-scroll to bottom
  conversationLog.scrollTop = conversationLog.scrollHeight;
  
  // Update message counter
  updateMessageCounter();
}

// Helper function to add activity entries to the activity log
function addActivityEntry(type, description) {
  const activityLog = document.getElementById('activityLog');
  if (!activityLog) return;

  const activityEntry = document.createElement('div');
  activityEntry.className = 'activity-entry';
  
  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();
  
  const activityType = document.createElement('span');
  activityType.className = 'activity-type';
  activityType.textContent = type;
  
  const activityDesc = document.createElement('span');
  activityDesc.className = 'activity-desc';
  activityDesc.textContent = description;
  
  activityEntry.appendChild(timestamp);
  activityEntry.appendChild(activityType);
  activityEntry.appendChild(activityDesc);
  activityLog.appendChild(activityEntry);
  
  // Auto-scroll to bottom
  activityLog.scrollTop = activityLog.scrollHeight;
  
  // Update function counter if it's a function call
  if (type === 'FUNCTION' || type === 'TOOL') {
    updateFunctionCounter();
  }
}

// Update status counters
function updateMessageCounter() {
  const messageCount = document.getElementById('messageCount');
  const conversationLog = document.getElementById('conversationLog');
  if (messageCount && conversationLog) {
    const messages = conversationLog.querySelectorAll('.log-entry:not(.system)');
    messageCount.textContent = messages.length;
  }
}

function updateFunctionCounter() {
  const functionCount = document.getElementById('functionCount');
  const activityLog = document.getElementById('activityLog');
  if (functionCount && activityLog) {
    const functions = activityLog.querySelectorAll('.activity-type');
    const functionCalls = Array.from(functions).filter(f => 
      f.textContent === 'FUNCTION' || f.textContent === 'TOOL'
    );
    functionCount.textContent = functionCalls.length;
  }
}

// Update connection status
function updateConnectionStatus(connected) {
  const connectionStatus = document.getElementById('connectionStatus');
  const modeStatus = document.getElementById('modeStatus');
  
  if (connectionStatus) {
    connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
    connectionStatus.className = `status-value ${connected ? 'connected' : 'disconnected'}`;
  }
  
  if (modeStatus) {
    modeStatus.textContent = connected ? 'Active' : 'Standby';
  }
}

// Function to fetch full transcript from ElevenLabs API via our backend
async function fetchFullTranscript(conversationId) {
  try {
    console.log('Fetching full transcript for conversation:', conversationId);
    addTranscriptEntry('system', `Fetching full transcript for conversation ${conversationId}...`);
    
    const response = await fetch(`http://localhost:8000/elevenlabs/conversation/${conversationId}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.transcript) {
        addTranscriptEntry('system', `Full transcript loaded (${data.transcript.length} messages)`);
        
        // Add all transcript entries to the log
        data.transcript.forEach(entry => {
          const role = entry.role === 'user' ? 'user' : 'vesta';
          const timestamp = entry.timestamp ? ` (${entry.timestamp}s)` : '';
          addTranscriptEntry(role, `${entry.message}${timestamp}`);
        });
        
        addTranscriptEntry('system', 'Full transcript loaded successfully');
      } else {
        addTranscriptEntry('system', 'No transcript data available');
      }
    } else {
      const errorData = await response.json();
      console.error('Backend error:', errorData);
      addTranscriptEntry('system', `Error: ${errorData.detail || 'Failed to fetch transcript'}`);
    }
    
  } catch (error) {
    console.error('Error fetching transcript:', error);
    addTranscriptEntry('system', 'Error connecting to backend for transcript fetch');
  }
}

// Initialize clear button event listeners
function initializeClearButtons() {
  const clearActivityBtn = document.getElementById('clearActivityBtn');
  if (clearActivityBtn) {
    clearActivityBtn.addEventListener('click', () => {
      const activityLog = document.getElementById('activityLog');
      if (activityLog) {
        activityLog.innerHTML = '';
        addActivityEntry('SYSTEM', 'Activity log cleared');
        updateFunctionCounter();
      }
    });
  }
  
  const clearLogBtn = document.getElementById('clearLogBtn');
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      const conversationLog = document.getElementById('conversationLog');
      if (conversationLog) {
        conversationLog.innerHTML = '';
        addTranscriptEntry('system', 'Conversation log cleared');
        updateMessageCounter();
      }
    });
  }
}

// Debug function to test transcript functionality
function testTranscript() {
  console.log('🧪 Testing transcript functionality...');
  addTranscriptEntry('user', 'This is a test user message');
  addTranscriptEntry('vesta', 'This is a test AI response');
  addTranscriptEntry('system', 'Transcript test completed');
  addActivityEntry('TEST', 'Manual transcript test executed');
}

// Make testTranscript available globally for debugging
window.testTranscript = testTranscript;

// Update page title and header based on current flow
function updatePageContent() {
  console.log(`🔧 updatePageContent called with agentConfig:`, agentConfig);
  
  // Update page title
  document.title = `${agentConfig.title} - Vesta AI`;
  console.log(`🔧 Document title set to: ${document.title}`);
  
  // Update page header if it exists
  const pageTitle = document.querySelector('.page-title');
  console.log(`🔧 Page title element found:`, pageTitle);
  if (pageTitle) {
    console.log(`🔧 Current page title text: "${pageTitle.textContent}"`);
    pageTitle.textContent = agentConfig.title;
    console.log(`🔧 New page title text: "${pageTitle.textContent}"`);
  } else {
    console.error(`❌ .page-title element not found!`);
  }
  
  // Update loading message to be flow-specific
  const loadingMessage = document.querySelector('.widget-loading p');
  if (loadingMessage) {
    loadingMessage.textContent = `Loading ${agentConfig.title}...`;
    console.log(`🔧 Loading message updated to: "${loadingMessage.textContent}"`);
  }
  
  console.log(`📝 Updated page content for: ${agentConfig.title}`);
}

// Simple immediate execution to update title
console.log('🚀 Starting title update immediately...');
updatePageContent();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  console.log('📋 DOM loading - adding event listener');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 DOM loaded - running initialization');
    updatePageContent();
    injectElevenLabsWidget();
    initializeClearButtons();
    // Add initial test transcript to verify functionality
    setTimeout(() => {
      addTranscriptEntry('system', `${agentConfig.title} loaded successfully. Ready for conversation.`);
      addActivityEntry('INIT', `${currentFlow.toUpperCase()} agent initialized`);
    }, 1000);
  });
} else {
  console.log('📋 DOM already ready - running initialization immediately');
  updatePageContent();
  injectElevenLabsWidget();
  initializeClearButtons();
  // Add initial test transcript to verify functionality
  setTimeout(() => {
    addTranscriptEntry('system', `${agentConfig.title} loaded successfully. Ready for conversation.`);
    addActivityEntry('INIT', `${currentFlow.toUpperCase()} agent initialized`);
  }, 1000);
}