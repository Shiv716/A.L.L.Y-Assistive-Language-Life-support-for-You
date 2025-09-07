#!/bin/bash

# ============================================================================
# VESTA MULTI-AGENT DEMO STARTUP SCRIPT
# ============================================================================

echo "🚀 Starting Vesta Multi-Agent Demo..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill any existing servers
echo "🧹 Cleaning up existing servers..."
pkill -f "python.*http.server" 2>/dev/null
pkill -f "main.py" 2>/dev/null
sleep 2

# Start backend server
echo -e "${BLUE}🔧 Starting live-backend server on port 8001...${NC}"
cd live-backend
python main.py &
BACKEND_PID=$!
cd ..
sleep 3

# Start frontend servers for each agent flow
echo ""
echo -e "${GREEN}🎭 Starting agent demo servers...${NC}"

# Flow 1: Energetic Good Morning (Port 3000)
echo -e "${YELLOW}  🌅 Flow 1: energetic good morning${NC} → http://localhost:3000?flow=flow1"
cd frontend
python -m http.server 3000 &
FLOW1_PID=$!
cd ..

# Flow 2: Mental Engagement (Port 3001)  
echo -e "${YELLOW}  🧠 Flow 2: keeping user mentally engaged${NC} → http://localhost:3001?flow=flow2"
cd frontend
python -m http.server 3001 &
FLOW2_PID=$!
cd ..

# Flow 3: Reminders (Port 3002)
echo -e "${YELLOW}  📋 Flow 3: reminders of key actions${NC} → http://localhost:3002?flow=flow3"
cd frontend  
python -m http.server 3002 &
FLOW3_PID=$!
cd ..

# Wait for servers to start
sleep 3

echo ""
echo -e "${GREEN}✅ All servers started successfully!${NC}"
echo ""
echo "📱 Demo URLs:"
echo "   • Flow 1 (Good Morning): http://localhost:3000?flow=flow1"
echo "   • Flow 2 (Mental Engagement): http://localhost:3001?flow=flow2" 
echo "   • Flow 3 (Reminders): http://localhost:3002?flow=flow3"
echo ""
echo "🔧 Backend API: http://localhost:8001"
echo ""
echo -e "${RED}Press Ctrl+C to stop all servers${NC}"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $BACKEND_PID $FLOW1_PID $FLOW2_PID $FLOW3_PID 2>/dev/null
    pkill -f "python.*http.server" 2>/dev/null
    pkill -f "main.py" 2>/dev/null
    echo "✅ All servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Keep script running
wait
