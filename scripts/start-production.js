#!/usr/bin/env node

// Script de inicio optimizado para producción
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Ticketera in Production Mode');
console.log('=====================================\n');

// Verificar que estamos en modo producción
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  Setting NODE_ENV to production');
  process.env.NODE_ENV = 'production';
}

// Configuraciones optimizadas para Node.js en producción
const nodeOptions = [
  '--max-old-space-size=2048',  // 2GB heap máximo
  '--optimize-for-size',         // Optimizar para tamaño
  '--gc-interval=100',          // Garbage collection más frecuente
  '--max-semi-space-size=128'   // Optimizar young generation
];

// Verificar archivos críticos
const criticalFiles = [
  'server.js',
  'package.json',
  '.env',
  'src/db.js',
  'src/redis.js'
];

console.log('📋 Checking critical files...');
for (const file of criticalFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Critical file missing: ${file}`);
    process.exit(1);
  }
}
console.log('✅ All critical files present\n');

// Verificar variables de entorno críticas
const requiredEnvVars = [
  'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'REDIS_HOST', 'MP_ACCESS_TOKEN'
];

console.log('🔧 Checking environment variables...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}
console.log('✅ All required environment variables present\n');

// Configurar logging para producción
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log('📁 Created logs directory');
}

// Configurar archivos de log
const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
const errorLogFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);

console.log('📝 Log files:');
console.log(`   - Application: ${logFile}`);
console.log(`   - Errors: ${errorLogFile}\n`);

// Iniciar la aplicación
console.log('🎯 Starting application with optimized settings...\n');

const serverPath = path.join(__dirname, '..', 'server.js');
const child = spawn('node', [...nodeOptions, serverPath], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// Configurar logging
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const errorLogStream = fs.createWriteStream(errorLogFile, { flags: 'a' });

// Pipe stdout to console and log file
child.stdout.on('data', (data) => {
  const message = data.toString();
  process.stdout.write(message);
  logStream.write(`[${new Date().toISOString()}] ${message}`);
});

// Pipe stderr to console and error log file
child.stderr.on('data', (data) => {
  const message = data.toString();
  process.stderr.write(message);
  errorLogStream.write(`[${new Date().toISOString()}] ERROR: ${message}`);
});

// Manejar cierre del proceso
child.on('close', (code) => {
  const message = `\n🔴 Application exited with code ${code} at ${new Date().toISOString()}\n`;
  console.log(message);
  logStream.write(message);
  
  // Cerrar streams
  logStream.end();
  errorLogStream.end();
  
  if (code !== 0) {
    console.error('❌ Application crashed. Check error logs for details.');
    process.exit(code);
  }
});

// Manejar señales del sistema
process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  child.kill('SIGINT');
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  errorLogStream.write(`[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${error.stack}\n`);
  child.kill('SIGTERM');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  errorLogStream.write(`[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n`);
});

console.log('✅ Production startup script initialized');
console.log('📊 Monitor logs in real-time: tail -f logs/app-*.log');
console.log('🔍 Check errors: tail -f logs/error-*.log');
console.log('🛑 Stop gracefully: Ctrl+C or kill -TERM <pid>\n');
