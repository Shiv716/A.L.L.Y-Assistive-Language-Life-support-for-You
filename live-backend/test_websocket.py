"""
Simple WebSocket test client for the Vesta Live Backend
"""

import asyncio
import json
import websockets
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket():
    """Test WebSocket connection and basic functionality"""
    uri = "ws://localhost:8001/ws/conversation"
    
    try:
        async with websockets.connect(uri) as websocket:
            logger.info(f"Connected to {uri}")
            
            # Wait for session creation message
            response = await websocket.recv()
            session_data = json.loads(response)
            logger.info(f"Server response: {session_data}")
            
            # Start conversation
            start_message = {"type": "start", "user_id": "test_user"}
            await websocket.send(json.dumps(start_message))
            logger.info("Sent start message")
            
            # Wait for start confirmation
            response = await websocket.recv()
            start_data = json.loads(response)
            logger.info(f"Start response: {start_data}")
            
            # Send a test text message
            text_message = {"type": "text", "text": "Hello, this is a test message"}
            await websocket.send(json.dumps(text_message))
            logger.info("Sent test message")
            
            # Wait for response
            response = await websocket.recv()
            text_response = json.loads(response)
            logger.info(f"Text response: {text_response}")
            
            # Stop conversation
            stop_message = {"type": "stop"}
            await websocket.send(json.dumps(stop_message))
            logger.info("Sent stop message")
            
            # Wait for stop confirmation
            response = await websocket.recv()
            stop_data = json.loads(response)
            logger.info(f"Stop response: {stop_data}")
            
            logger.info("✅ WebSocket test completed successfully!")
            
    except websockets.exceptions.ConnectionRefused:
        logger.error("❌ Connection refused. Is the server running on port 8001?")
    except Exception as e:
        logger.error(f"❌ WebSocket test failed: {e}")

if __name__ == "__main__":
    print("🧪 Testing WebSocket connection to Vesta Live Backend...")
    print("Make sure the server is running: python main.py")
    print()
    
    asyncio.run(test_websocket())
