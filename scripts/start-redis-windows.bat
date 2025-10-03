@echo off
echo 🚀 Starting Redis for Ticketera...

REM Verificar si Redis ya está corriendo
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ Redis is already running
    goto :end
)

REM Crear directorio para Redis
if not exist "%~dp0..\redis-portable" mkdir "%~dp0..\redis-portable"

REM Verificar si Redis existe
if not exist "%~dp0..\redis-portable\redis-server.exe" (
    echo 📥 Redis not found. Please download Redis from:
    echo https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip
    echo Extract it to: %~dp0..\redis-portable\
    pause
    exit /b 1
)

REM Crear configuración básica
echo port 6379 > "%~dp0..\redis-portable\redis.conf"
echo bind 127.0.0.1 >> "%~dp0..\redis-portable\redis.conf"
echo maxmemory 128mb >> "%~dp0..\redis-portable\redis.conf"
echo maxmemory-policy allkeys-lru >> "%~dp0..\redis-portable\redis.conf"

REM Iniciar Redis
echo 🔄 Starting Redis server...
cd /d "%~dp0..\redis-portable"
start "Redis Server" redis-server.exe redis.conf

REM Esperar un poco y verificar
timeout /t 3 /nobreak >nul
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ Redis is running successfully on port 6379
    echo 🎯 Redis is ready for Ticketera!
    echo    You can now run: npm start
) else (
    echo ❌ Redis failed to start
    pause
    exit /b 1
)

:end
echo.
echo 💡 To stop Redis: taskkill /IM redis-server.exe /F
pause
