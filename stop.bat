@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Stopping All Services
echo ========================================
echo.

:: Stop Docker services
echo Stopping Docker services...
docker-compose down
if %errorlevel% equ 0 (
    echo [92mDocker services stopped[0m
) else (
    echo [93mWarning: Failed to stop Docker services (may not be running)[0m
)

:: Kill backend server (Go process on port 8000)
echo.
echo Stopping backend server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [92mBackend server stopped (PID: %%a)[0m
)

:: Kill gRPC server (Go process on port 9090)
echo.
echo Stopping gRPC server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :9090 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [92mgRPC server stopped (PID: %%a)[0m
)

:: Kill frontend server (Node process on port 5000 or 5173)
echo.
echo Stopping frontend server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [92mFrontend server stopped (PID: %%a)[0m
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [92mFrontend server stopped (PID: %%a)[0m
)

:: Also kill any remaining node.exe and go.exe processes from our app
echo.
echo Cleaning up remaining processes...
taskkill /F /IM "go.exe" /FI "WINDOWTITLE eq Backend Server*" >nul 2>&1
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq Frontend Server*" >nul 2>&1

echo.
echo ========================================
echo   ALL SERVICES STOPPED
echo ========================================
echo.
pause
