# Script para iniciar Redis en Windows sin Docker
Write-Host "🚀 Starting Redis for Ticketera..." -ForegroundColor Green

# Verificar si Redis ya está corriendo
$redisProcess = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
if ($redisProcess) {
    Write-Host "✅ Redis is already running (PID: $($redisProcess.Id))" -ForegroundColor Green
    exit 0
}

# Crear directorio para Redis portable
$redisDir = "$PSScriptRoot\..\redis-portable"
if (!(Test-Path $redisDir)) {
    New-Item -ItemType Directory -Path $redisDir -Force | Out-Null
}

# Descargar Redis portable si no existe
$redisExe = "$redisDir\redis-server.exe"
if (!(Test-Path $redisExe)) {
    Write-Host "📥 Downloading Redis portable..." -ForegroundColor Yellow
    
    # URL de Redis portable para Windows
    $redisUrl = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip"
    $zipFile = "$redisDir\redis.zip"
    
    try {
        Invoke-WebRequest -Uri $redisUrl -OutFile $zipFile -UseBasicParsing
        
        # Extraer ZIP
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zipFile, $redisDir)
        
        # Limpiar ZIP
        Remove-Item $zipFile -Force
        
        Write-Host "✅ Redis downloaded successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to download Redis: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "💡 Please download Redis manually from: https://github.com/tporadowski/redis/releases" -ForegroundColor Yellow
        exit 1
    }
}

# Crear configuración de Redis optimizada
$redisConf = "$redisDir\redis.conf"
$configContent = @"
# Redis configuration for Ticketera
port 6379
bind 127.0.0.1
timeout 0
tcp-keepalive 300
daemonize no
supervised no
pidfile redis.pid
loglevel notice
logfile ""
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ./
maxmemory 128mb
maxmemory-policy allkeys-lru
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
"@

Set-Content -Path $redisConf -Value $configContent -Encoding UTF8

# Iniciar Redis
Write-Host "🔄 Starting Redis server..." -ForegroundColor Yellow
try {
    $process = Start-Process -FilePath $redisExe -ArgumentList $redisConf -WindowStyle Minimized -PassThru
    Start-Sleep -Seconds 2
    
    # Verificar que Redis está corriendo
    $testConnection = Test-NetConnection -ComputerName "127.0.0.1" -Port 6379 -WarningAction SilentlyContinue
    if ($testConnection.TcpTestSucceeded) {
        Write-Host "✅ Redis is running successfully on port 6379" -ForegroundColor Green
        Write-Host "📊 Process ID: $($process.Id)" -ForegroundColor Cyan
        Write-Host "🛑 To stop Redis: taskkill /PID $($process.Id) /F" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Redis failed to start properly" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Failed to start Redis: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎯 Redis is ready for Ticketera!" -ForegroundColor Green
Write-Host "   You can now run: npm start" -ForegroundColor Cyan
