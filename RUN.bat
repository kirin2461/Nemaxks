@echo off
echo.
echo ==========================================
echo   Запуск приложения
echo ==========================================
echo.

:: Установка зависимостей frontend (если нужно)
if not exist "frontend\node_modules" (
    echo Установка зависимостей frontend...
    cd frontend
    call npm install
    cd ..
    echo.
)

:: Запуск frontend
echo Запуск frontend сервера...
start "Frontend Server" cmd /k "cd frontend && npm run dev"
timeout /t 3 /nobreak >nul

:: Запуск backend
echo Запуск backend сервера...
start "Backend Server" cmd /k "cd backend && go run ."
timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo   СЕРВЕРЫ ЗАПУЩЕНЫ
echo ==========================================
echo.
echo Frontend:  http://localhost:5000
echo Backend:   http://localhost:8000
echo.
echo Откройте в браузере: http://localhost:5000
echo.
echo Для остановки: stop.bat
echo.
pause
