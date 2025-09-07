# 🎭 Vesta Multi-Agent Demo Guide

## Quick Start

```bash
# Start all demo servers at once
./start-demo.sh
```

## Demo URLs

| Flow | Description | URL | Agent ID |
|------|-------------|-----|----------|
| **Flow 1** | Energetic good morning | http://localhost:3000?flow=flow1 | `agent_7401k4g1r9m7fsh9xpg0a5zn8h1w` |
| **Flow 2** | Keeping user mentally engaged | http://localhost:3001?flow=flow2 | `agent_0201k4f0z28heg7t3zs2yw3mqbqv` |
| **Flow 3** | Reminders of key actions | http://localhost:3002?flow=flow3 | `agent_2801k4hv7keze68tgybjty5qd1v6` |

## Architecture

- **Single Codebase**: Same `index.html` and `widget.js` for all flows
- **Dynamic Agent Switching**: URL parameters determine which agent loads
- **Real-time Configuration**: Page title and content update automatically
- **Multi-Port Serving**: Each flow served on different port for demo purposes

## Demo Flow

1. **Start Demo**: Run `./start-demo.sh`
2. **Open Tabs**: Open all 3 URLs in different browser tabs
3. **Compare Agents**: Switch between tabs to see different agent personalities
4. **Voice Interaction**: Speak to each agent to experience different responses
5. **Stop Demo**: Press `Ctrl+C` in terminal to stop all servers

## Backend

- **Live Backend**: Running on http://localhost:8001
- **ElevenLabs Integration**: Uses your API key from `.env` file
- **WebSocket Support**: Real-time conversation handling

## Debugging

- **Browser Console**: Check for agent loading logs (🎯, 🤖 emojis)
- **Network Tab**: Verify ElevenLabs widget script loading
- **Terminal Output**: Server status and error messages

## Customization

To add more agents:
1. Add new config to `AGENT_CONFIGS` in `widget.js`
2. Add new port/URL to `start-demo.sh`
3. Update this guide with new flow information
