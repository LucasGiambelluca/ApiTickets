#!/usr/bin/env node

/**
 * 🚀 SCRIPT DE CONFIGURACIÓN RÁPIDA PARA TICKETERA
 * 
 * Este script configura automáticamente las variables de entorno
 * y verifica que todos los servicios estén funcionando correctamente.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🎫 TICKETERA - Configuración Rápida');
console.log('=' .repeat(50));

// Configuración por defecto
const defaultConfig = {
  // Base de datos
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: 'ticketera',
  
  // Servidor
  PORT: '3000',
  BASE_URL: 'http://localhost:3000',
  ALLOWED_ORIGINS: '*',
  HEALTH_ALLOW_DEGRADED: 'true',
  
  // Redis
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: '',
  
  // Colas
  QUEUE_MAX_SIZE: '1000',
  QUEUE_TIMEOUT_MINUTES: '15',
  
  // MercadoPago (TEST)
  MP_ACCESS_TOKEN: 'TEST-your-access-token-here',
  
  // Archivos
  UPLOAD_PATH: './uploads',
  MAX_FILE_SIZE: '5242880',
  
  // Seguridad
  JWT_SECRET: 'your-jwt-secret-' + Math.random().toString(36).substring(7),
  SESSION_SECRET: 'your-session-secret-' + Math.random().toString(36).substring(7)
};

// Función para crear archivo .env
function createEnvFile() {
  console.log('\n📝 Creando archivo .env...');
  
  const envContent = Object.entries(defaultConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const envPath = path.join(__dirname, '.env');
  
  try {
    // Verificar si ya existe
    if (fs.existsSync(envPath)) {
      console.log('⚠️  El archivo .env ya existe. Creando backup...');
      fs.copyFileSync(envPath, `${envPath}.backup.${Date.now()}`);
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Archivo .env creado exitosamente');
    
    // Mostrar configuración
    console.log('\n📋 Configuración aplicada:');
    console.log(`   🗄️  Base de datos: ${defaultConfig.DB_HOST}:${defaultConfig.DB_PORT}/${defaultConfig.DB_NAME}`);
    console.log(`   🚀 Servidor: ${defaultConfig.BASE_URL}`);
    console.log(`   🔴 Redis: ${defaultConfig.REDIS_HOST}:${defaultConfig.REDIS_PORT}`);
    
  } catch (error) {
    console.error('❌ Error creando archivo .env:', error.message);
    return false;
  }
  
  return true;
}

// Función para verificar conectividad
function checkService(host, port, name) {
  return new Promise((resolve) => {
    const client = http.request({
      host: host,
      port: port,
      method: 'GET',
      timeout: 2000
    }, () => {
      resolve(true);
    });
    
    client.on('error', () => resolve(false));
    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });
    
    client.end();
  });
}

// Función para verificar servicios
async function checkServices() {
  console.log('\n🔍 Verificando servicios...');
  
  // Verificar MySQL
  const mysqlRunning = await checkService('localhost', 3306, 'MySQL');
  console.log(`   🗄️  MySQL (3306): ${mysqlRunning ? '✅ Disponible' : '❌ No disponible'}`);
  
  // Verificar Redis
  const redisRunning = await checkService('127.0.0.1', 6379, 'Redis');
  console.log(`   🔴 Redis (6379): ${redisRunning ? '✅ Disponible' : '❌ No disponible'}`);
  
  return { mysql: mysqlRunning, redis: redisRunning };
}

// Función para mostrar comandos de instalación
function showInstallCommands(services) {
  console.log('\n📦 COMANDOS DE INSTALACIÓN:');
  
  if (!services.mysql) {
    console.log('\n🗄️  Para instalar MySQL:');
    console.log('   Windows: https://dev.mysql.com/downloads/installer/');
    console.log('   macOS: brew install mysql');
    console.log('   Ubuntu: sudo apt install mysql-server');
    console.log('   \n   Después de instalar, crear la base de datos:');
    console.log('   mysql -u root -p -e "CREATE DATABASE ticketera;"');
  }
  
  if (!services.redis) {
    console.log('\n🔴 Para instalar Redis:');
    console.log('   Windows: https://github.com/microsoftarchive/redis/releases');
    console.log('   macOS: brew install redis');
    console.log('   Ubuntu: sudo apt install redis-server');
    console.log('   \n   Para iniciar Redis:');
    console.log('   redis-server');
  }
}

// Función para mostrar próximos pasos
function showNextSteps(services) {
  console.log('\n🎯 PRÓXIMOS PASOS:');
  
  if (services.mysql && services.redis) {
    console.log('   ✅ Todos los servicios están disponibles');
    console.log('   \n   1. Ejecutar: npm install');
    console.log('   2. Ejecutar: npm run db:schema');
    console.log('   3. Ejecutar: npm run db:upgrade-tickets');
    console.log('   4. Ejecutar: npm start');
    console.log('   5. Abrir: http://localhost:3000/health');
  } else {
    console.log('   ⚠️  Algunos servicios no están disponibles');
    console.log('   \n   1. Instalar servicios faltantes (ver comandos arriba)');
    console.log('   2. Ejecutar: node quick-setup.js (nuevamente)');
    console.log('   3. Continuar con la configuración de la base de datos');
  }
  
  console.log('\n📚 DOCUMENTACIÓN:');
  console.log('   📄 Endpoints: EJEMPLOS_PAYLOADS_JSON.md');
  console.log('   📊 Informe: INFORME_ENDPOINTS_TESTING.md');
  console.log('   🏥 Health: http://localhost:3000/health');
}

// Función principal
async function main() {
  try {
    // Crear archivo .env
    const envCreated = createEnvFile();
    if (!envCreated) {
      process.exit(1);
    }
    
    // Verificar servicios
    const services = await checkServices();
    
    // Mostrar comandos de instalación si es necesario
    if (!services.mysql || !services.redis) {
      showInstallCommands(services);
    }
    
    // Mostrar próximos pasos
    showNextSteps(services);
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Configuración completada');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Error durante la configuración:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { createEnvFile, checkServices };
