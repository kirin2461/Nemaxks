@echo off
echo.
echo ========================================
echo   Quick Start (Skip Checks)
echo ========================================
echo.

:: Start Docker services (ignore errors)
echo Starting Docker services...
docker-compose up -d 2>nul
timeout /t 2 /nobreak >nul

:: Start backend in new window
echo Starting backend server...
start "Backend Server - Port 8000" cmd /k "cd backend && echo Backend Server Starting... && go run . && pause"
timeout /t 2 /nobreak >nul

:: Start frontend in new window
echo Starting frontend server...
start "Frontend Server - Port 5173" cmd /k "cd frontend && echo Frontend Server Starting... && npm run dev && pause"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   SERVERS STARTING
echo ========================================
echo.
echo Check the new windows for server output
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:8000
echo.
echo To stop: run stop.bat
echo.
echo Press any key to close this window...
pause >nul
