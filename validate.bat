@echo off
setlocal enabledelayedexpansion

echo.
echo Validating all changes...
echo.

set ERRORS=0
set WARNINGS=0

echo Checking file structure...
echo ================================

call :check_file "proto\voice.proto"
call :check_file "proto\auth.proto"
call :check_file "proto\channels.proto"
call :check_file "backend\grpc_server.go"
call :check_file "backend\redis.go"
call :check_file "backend\livekit.go"
call :check_file "backend\handlers_livekit.go"
call :check_file "envoy.yaml"
call :check_file "livekit.yaml"
call :check_file "docker-compose.yml"
call :check_file "Makefile"
call :check_file ".env.example"
call :check_file "REDIS_LIVEKIT_SETUP.md"
call :check_file "GRPC_SETUP.md"

echo.
echo Checking environment configuration...
echo ================================

findstr /C:"REDIS_URL" .env.example >nul && (
    echo [92m[PASS][0m REDIS_URL configured
) || (
    echo [91m[FAIL][0m REDIS_URL missing
    set /a ERRORS+=1
)

findstr /C:"LIVEKIT_URL" .env.example >nul && (
    echo [92m[PASS][0m LIVEKIT_URL configured
) || (
    echo [91m[FAIL][0m LIVEKIT_URL missing
    set /a ERRORS+=1
)

findstr /C:"GRPC_PORT" .env.example >nul && (
    echo [92m[PASS][0m GRPC_PORT configured
) || (
    echo [91m[FAIL][0m GRPC_PORT missing
    set /a ERRORS+=1
)

findstr /C:"ENVOY_PORT" .env.example >nul && (
    echo [92m[PASS][0m ENVOY_PORT configured
) || (
    echo [91m[FAIL][0m ENVOY_PORT missing
    set /a ERRORS+=1
)

echo.
echo Checking Go installation...
echo ================================

where go >nul 2>&1 && (
    echo [92m[PASS][0m Go is installed
) || (
    echo [93m[WARN][0m Go not installed - install from https://go.dev/dl/
    set /a WARNINGS+=1
)

echo.
echo Checking Docker installation...
echo ================================

where docker >nul 2>&1 && (
    echo [92m[PASS][0m Docker is installed
) || (
    echo [93m[WARN][0m Docker not installed - install from https://www.docker.com/
    set /a WARNINGS+=1
)

echo.
echo ===============================
echo Summary:
echo ===============================

if %ERRORS% EQU 0 (
    echo [92mAll checks passed![0m
) else (
    echo [91mFound %ERRORS% error^(s^)[0m
)

if %WARNINGS% GTR 0 (
    echo [93mFound %WARNINGS% warning^(s^)[0m
)

echo.
echo Next steps:
echo 1. make proto-install    # Install protoc dependencies
echo 2. make proto             # Generate gRPC code
echo 3. docker-compose up -d   # Start infrastructure
echo 4. cd backend ^&^& go run . # Start servers

exit /b %ERRORS%

:check_file
if exist %~1 (
    echo [92m[PASS][0m %~1 exists
) else (
    echo [91m[FAIL][0m %~1 missing
    set /a ERRORS+=1
)
goto :eof
