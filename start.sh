#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "  Starting Full Stack Application"
echo "========================================"
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}ERROR: Go is not installed${NC}"
    echo "Please install Go from https://go.dev/dl/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if Docker is installed
SKIP_DOCKER=0
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}WARNING: Docker is not installed${NC}"
    echo "Optional features (Redis, LiveKit, Envoy) won't be available"
    echo "Install Docker from https://www.docker.com/"
    SKIP_DOCKER=1
fi

# Check if protoc is installed
SKIP_GRPC=0
if ! command -v protoc &> /dev/null; then
    echo -e "${YELLOW}WARNING: protoc is not installed${NC}"
    echo "gRPC features won't be available"
    echo "Install: brew install protobuf (macOS) or sudo apt install protobuf-compiler (Linux)"
    SKIP_GRPC=1
fi

echo ""
echo "[1] Installing dependencies..."
echo "========================================"

# Install backend dependencies
echo "Installing Go dependencies..."
cd backend
go mod download
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to download Go dependencies${NC}"
    exit 1
fi
cd ..

# Install frontend dependencies
echo "Installing Node.js dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to install Node.js dependencies${NC}"
    exit 1
fi
cd ..

# Generate proto files if protoc is available
if [ $SKIP_GRPC -eq 0 ]; then
    echo ""
    echo "[2] Generating gRPC proto files..."
    echo "========================================"

    # Check if proto tools are installed
    if ! command -v protoc-gen-go &> /dev/null; then
        echo "Installing proto generation tools..."
        go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
        go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
        go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest

        # Add GOPATH/bin to PATH if not already there
        export PATH="$PATH:$(go env GOPATH)/bin"
    fi

    # Clone googleapis if not exists
    if [ ! -d "third_party/googleapis" ]; then
        echo "Downloading googleapis..."
        git clone https://github.com/googleapis/googleapis.git third_party/googleapis
    fi

    # Generate proto files
    echo "Generating proto files..."
    protoc --go_out=. --go_opt=paths=source_relative \
        --go-grpc_out=. --go-grpc_opt=paths=source_relative \
        --grpc-gateway_out=. --grpc-gateway_opt=paths=source_relative \
        -I proto -I third_party/googleapis \
        proto/voice.proto proto/auth.proto proto/channels.proto

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Proto files generated successfully${NC}"
    else
        echo -e "${YELLOW}Warning: Proto generation failed, gRPC features won't work${NC}"
    fi
fi

# Start Docker services if available
if [ $SKIP_DOCKER -eq 0 ]; then
    echo ""
    echo "[3] Starting infrastructure services..."
    echo "========================================"

    docker-compose up -d
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Infrastructure started (Redis, LiveKit, Envoy)${NC}"
        echo "Waiting 5 seconds for services to initialize..."
        sleep 5
    else
        echo -e "${YELLOW}Warning: Failed to start Docker services${NC}"
    fi
else
    echo ""
    echo "[3] Skipping infrastructure services (Docker not available)"
    echo "========================================"
fi

echo ""
echo "[4] Starting backend server..."
echo "========================================"

# Create logs directory if it doesn't exist
mkdir -p logs

# Start backend in background
cd backend
nohup go run . > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd ..
echo -e "${GREEN}Backend server starting on port 8000 (PID: $BACKEND_PID)${NC}"
sleep 3

echo ""
echo "[5] Starting frontend server..."
echo "========================================"

# Start frontend in background
cd frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
cd ..
echo -e "${GREEN}Frontend server starting on port 5173 (PID: $FRONTEND_PID)${NC}"

echo ""
echo "========================================"
echo "  ALL SERVICES STARTED"
echo "========================================"
echo ""
echo "Frontend:  http://localhost:5173"
echo "Backend:   http://localhost:8000"
if [ $SKIP_DOCKER -eq 0 ]; then
    echo "Envoy:     http://localhost:8080"
    echo "Redis:     localhost:6379"
    echo "LiveKit:   http://localhost:7880"
fi
echo ""
echo "Logs are in the logs/ directory:"
echo "  - logs/backend.log"
echo "  - logs/frontend.log"
echo ""
echo "To stop all services, run: ./stop.sh"
echo ""
echo "Tailing backend logs (Ctrl+C to exit, services will keep running):"
echo "----------------------------------------------------------------------"
tail -f logs/backend.log
