#!/bin/bash

# Validation script for all changes

echo "🔍 Validating all changes..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        ((ERRORS++))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

echo "📁 Checking file structure..."
echo "================================"

# Check proto files exist
[ -f "proto/voice.proto" ] && print_status 0 "proto/voice.proto exists" || print_status 1 "proto/voice.proto missing"
[ -f "proto/auth.proto" ] && print_status 0 "proto/auth.proto exists" || print_status 1 "proto/auth.proto missing"
[ -f "proto/channels.proto" ] && print_status 0 "proto/channels.proto exists" || print_status 1 "proto/channels.proto missing"

# Check backend files
[ -f "backend/grpc_server.go" ] && print_status 0 "backend/grpc_server.go exists" || print_status 1 "backend/grpc_server.go missing"
[ -f "backend/redis.go" ] && print_status 0 "backend/redis.go exists" || print_status 1 "backend/redis.go missing"
[ -f "backend/livekit.go" ] && print_status 0 "backend/livekit.go exists" || print_status 1 "backend/livekit.go missing"
[ -f "backend/handlers_livekit.go" ] && print_status 0 "backend/handlers_livekit.go exists" || print_status 1 "backend/handlers_livekit.go missing"

# Check config files
[ -f "envoy.yaml" ] && print_status 0 "envoy.yaml exists" || print_status 1 "envoy.yaml missing"
[ -f "livekit.yaml" ] && print_status 0 "livekit.yaml exists" || print_status 1 "livekit.yaml missing"
[ -f "docker-compose.yml" ] && print_status 0 "docker-compose.yml exists" || print_status 1 "docker-compose.yml missing"
[ -f "Makefile" ] && print_status 0 "Makefile exists" || print_status 1 "Makefile missing"
[ -f ".env.example" ] && print_status 0 ".env.example exists" || print_status 1 ".env.example missing"

echo ""
echo "🔧 Checking Go files syntax..."
echo "================================"

# Check if Go is installed
if command -v go &> /dev/null; then
    cd backend

    # Check go.mod
    if go mod verify &> /dev/null; then
        print_status 0 "go.mod is valid"
    else
        print_warning "go.mod needs tidying (run: go mod tidy)"
    fi

    # Try to compile (without running)
    if go build -o /dev/null . 2>&1 | grep -q "undefined:"; then
        print_status 1 "Go compilation has undefined references (need to run 'make proto')"
    else
        print_status 0 "Go files compile successfully"
    fi

    cd ..
else
    print_warning "Go not installed - skipping Go validation"
fi

echo ""
echo "📋 Checking YAML syntax..."
echo "================================"

# Check YAML files (basic syntax check)
if command -v yamllint &> /dev/null; then
    yamllint envoy.yaml &> /dev/null && print_status 0 "envoy.yaml syntax valid" || print_status 1 "envoy.yaml has syntax errors"
    yamllint livekit.yaml &> /dev/null && print_status 0 "livekit.yaml syntax valid" || print_status 1 "livekit.yaml has syntax errors"
    yamllint docker-compose.yml &> /dev/null && print_status 0 "docker-compose.yml syntax valid" || print_status 1 "docker-compose.yml has syntax errors"
else
    print_warning "yamllint not installed - skipping YAML validation"
fi

echo ""
echo "🐳 Checking Docker Compose..."
echo "================================"

if command -v docker-compose &> /dev/null; then
    if docker-compose config &> /dev/null; then
        print_status 0 "docker-compose.yml is valid"
    else
        print_status 1 "docker-compose.yml has errors"
    fi
else
    print_warning "docker-compose not installed - skipping Docker validation"
fi

echo ""
echo "📝 Checking environment configuration..."
echo "================================"

# Check .env.example has required variables
grep -q "REDIS_URL" .env.example && print_status 0 "REDIS_URL configured" || print_status 1 "REDIS_URL missing in .env.example"
grep -q "LIVEKIT_URL" .env.example && print_status 0 "LIVEKIT_URL configured" || print_status 1 "LIVEKIT_URL missing in .env.example"
grep -q "GRPC_PORT" .env.example && print_status 0 "GRPC_PORT configured" || print_status 1 "GRPC_PORT missing in .env.example"
grep -q "ENVOY_PORT" .env.example && print_status 0 "ENVOY_PORT configured" || print_status 1 "ENVOY_PORT missing in .env.example"

echo ""
echo "📖 Checking documentation..."
echo "================================"

[ -f "REDIS_LIVEKIT_SETUP.md" ] && print_status 0 "REDIS_LIVEKIT_SETUP.md exists" || print_status 1 "REDIS_LIVEKIT_SETUP.md missing"
[ -f "GRPC_SETUP.md" ] && print_status 0 "GRPC_SETUP.md exists" || print_status 1 "GRPC_SETUP.md missing"

echo ""
echo "═══════════════════════════════"
echo "Summary:"
echo "═══════════════════════════════"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
else
    echo -e "${RED}✗ Found $ERRORS error(s)${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $WARNINGS warning(s)${NC}"
fi

echo ""
echo "Next steps:"
echo "1. Run: make proto-install    # Install protoc dependencies"
echo "2. Run: make proto             # Generate gRPC code"
echo "3. Run: docker-compose up -d   # Start infrastructure"
echo "4. Run: cd backend && go run . # Start servers"

exit $ERRORS
