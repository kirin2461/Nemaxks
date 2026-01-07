@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Starting Full Stack Application
echo ========================================
echo.

:: Check if Go is installed
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mERROR: Go is not installed[0m
    echo Please install Go from https://go.dev/dl/
    pause
    exit /b 1
)

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mERROR: Node.js is not installed[0m
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if Docker is installed
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [93mWARNING: Docker is not installed[0m
    echo Optional features (Redis, LiveKit, Envoy) won't be available
    echo Install Docker from https://www.docker.com/
    set SKIP_DOCKER=1
) else (
    set SKIP_DOCKER=0
)

:: Check if protoc is installed
where protoc >nul 2>&1
if %errorlevel% neq 0 (
    echo [93mWARNING: protoc is not installed[0m
    echo gRPC features won't be available
    echo Install protoc: choco install protobuf
    set SKIP_GRPC=1
) else (
    set SKIP_GRPC=0
)

echo.
echo [1] Installing dependencies...
echo ========================================

:: Install backend dependencies
echo Installing Go dependencies...
cd backend
go mod download
if %errorlevel% neq 0 (
    echo [91mERROR: Failed to download Go dependencies[0m
    echo.
    pause
    cd ..
    exit /b 1
)
echo [92mGo dependencies installed successfully[0m
cd ..

:: Install frontend dependencies
echo Installing Node.js dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [91mERROR: Failed to install Node.js dependencies[0m
    echo.
    pause
    cd ..
    exit /b 1
)
echo [92mNode.js dependencies installed successfully[0m
cd ..

:: Generate proto files if protoc is available
if %SKIP_GRPC% equ 0 (
    echo.
    echo [2] Generating gRPC proto files...
    echo ========================================

    :: Check if proto tools are installed
    where protoc-gen-go >nul 2>&1
    if %errorlevel% neq 0 (
        echo Installing proto generation tools...
        go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
        go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
        go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
    )

    :: Clone googleapis if not exists
    if not exist "third_party\googleapis" (
        echo Downloading googleapis...
        git clone https://github.com/googleapis/googleapis.git third_party/googleapis
    )

    :: Generate proto files
    echo Generating proto files...
    protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative --grpc-gateway_out=. --grpc-gateway_opt=paths=source_relative -I proto -I third_party/googleapis proto/voice.proto proto/auth.proto proto/channels.proto

    if %errorlevel% equ 0 (
        echo [92mProto files generated successfully[0m
    ) else (
        echo [93mWarning: Proto generation failed, gRPC features won't work[0m
    )
)

:: Start Docker services if available
if %SKIP_DOCKER% equ 0 (
    echo.
    echo [3] Starting infrastructure services...
    echo ========================================

    docker-compose up -d
    if %errorlevel% equ 0 (
        echo [92mInfrastructure started (Redis, LiveKit, Envoy)[0m
        echo Waiting 5 seconds for services to initialize...
        timeout /t 5 /nobreak >nul
    ) else (
        echo [93mWarning: Failed to start Docker services[0m
    )
) else (
    echo.
    echo [3] Skipping infrastructure services (Docker not available)
    echo ========================================
)

echo.
echo [4] Starting backend server...
echo ========================================

:: Start backend in new window
start "Backend Server" cmd /k "cd backend && go run . && pause"
echo [92mBackend server starting on port 8000...[0m
timeout /t 3 /nobreak >nul

echo.
echo [5] Starting frontend server...
echo ========================================

:: Start frontend in new window
start "Frontend Server" cmd /k "cd frontend && npm run dev && pause"
echo [92mFrontend server starting on port 5173...[0m

echo.
echo ========================================
echo   ALL SERVICES STARTED
echo ========================================
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:8000
if %SKIP_DOCKER% equ 0 (
    echo Envoy:     http://localhost:8080
    echo Redis:     localhost:6379
    echo LiveKit:   http://localhost:7880
)
echo.
echo Press Ctrl+C in each window to stop services
echo Or run stop.bat to stop all services
echo.
echo ========================================
echo This window will stay open. You can:
echo  - View the URLs above
echo  - Press any key to close this window
echo    (servers will keep running)
echo ========================================
echo.
pause
echo.
echo Servers are still running in separate windows.
echo To stop all servers, run: stop.bat
echo.
