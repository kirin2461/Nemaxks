#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "  Stopping All Services"
echo "========================================"
echo ""

# Stop Docker services
echo "Stopping Docker services..."
docker-compose down 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker services stopped${NC}"
else
    echo -e "${YELLOW}Warning: Failed to stop Docker services (may not be running)${NC}"
fi

# Stop backend server
echo ""
echo "Stopping backend server..."
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID
        echo -e "${GREEN}Backend server stopped (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${YELLOW}Backend server not running${NC}"
    fi
    rm logs/backend.pid
else
    # Fallback: try to find and kill by port
    PID=$(lsof -ti:8000)
    if [ ! -z "$PID" ]; then
        kill $PID
        echo -e "${GREEN}Backend server stopped (PID: $PID)${NC}"
    else
        echo -e "${YELLOW}Backend server not running${NC}"
    fi
fi

# Stop gRPC server (if running on different port)
echo ""
echo "Stopping gRPC server..."
PID=$(lsof -ti:9090)
if [ ! -z "$PID" ]; then
    kill $PID
    echo -e "${GREEN}gRPC server stopped (PID: $PID)${NC}"
else
    echo -e "${YELLOW}gRPC server not running${NC}"
fi

# Stop frontend server
echo ""
echo "Stopping frontend server..."
if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID
        echo -e "${GREEN}Frontend server stopped (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${YELLOW}Frontend server not running${NC}"
    fi
    rm logs/frontend.pid
else
    # Fallback: try to find and kill by port
    PID=$(lsof -ti:5173)
    if [ ! -z "$PID" ]; then
        kill $PID
        echo -e "${GREEN}Frontend server stopped (PID: $PID)${NC}"
    else
        echo -e "${YELLOW}Frontend server not running${NC}"
    fi
fi

# Clean up any remaining Vite processes
echo ""
echo "Cleaning up remaining processes..."
pkill -f "vite" 2>/dev/null

echo ""
echo "========================================"
echo "  ALL SERVICES STOPPED"
echo "========================================"
echo ""
