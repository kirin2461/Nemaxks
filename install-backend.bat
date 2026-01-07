@echo off
echo.
echo Установка зависимостей backend...
echo.
cd backend
go mod tidy
if %errorlevel% equ 0 (
    echo.
    echo [92mЗависимости установлены успешно![0m
    echo.
    echo Теперь можно запустить backend:
    echo go run .
) else (
    echo.
    echo [91mОшибка установки зависимостей[0m
)
echo.
pause
