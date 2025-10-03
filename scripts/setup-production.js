#!/usr/bin/env node

/**
 * Script de configuración automática para producción
 * Prepara la aplicación para despliegue en Railway, Render, etc.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 CONFIGURANDO TICKETERA PARA PRODUCCIÓN...\n');

// 1. Generar secretos de producción
console.log('🔑 Generando secretos de producción...');
const productionSecrets = {
  JWT_SECRET: crypto.randomBytes(64).toString('hex'),
  SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
  MERCADOPAGO_WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex')
};

// 2. Crear .env.production
console.log('📝 Creando .env.production...');
const productionEnv = `# 🚀 TICKETERA - CONFIGURACIÓN DE PRODUCCIÓN
# Generado automáticamente el ${new Date().toISOString()}

# ===== APLICACIÓN =====
NODE_ENV=production
PORT=3000
BASE_URL=https://tu-app.railway.app

# ===== BASE DE DATOS =====
# Railway/Render proporcionan estas automáticamente:
# DATABASE_URL=mysql://user:pass@host:port/db
# MYSQL_URL=mysql://user:pass@host:port/db
DB_HOST=\${MYSQL_HOST}
DB_PORT=\${MYSQL_PORT}
DB_USER=\${MYSQL_USER}
DB_PASSWORD=\${MYSQL_PASSWORD}
DB_NAME=\${MYSQL_DATABASE}
DB_SSL=true

# ===== REDIS =====
# Railway/Render proporcionan estas automáticamente:
# REDIS_URL=redis://default:pass@host:port
REDIS_HOST=\${REDIS_HOST}
REDIS_PORT=\${REDIS_PORT}
REDIS_PASSWORD=\${REDIS_PASSWORD}

# ===== SEGURIDAD =====
JWT_SECRET=${productionSecrets.JWT_SECRET}
JWT_EXPIRES_IN=24h
SESSION_SECRET=${productionSecrets.SESSION_SECRET}
MERCADOPAGO_WEBHOOK_SECRET=${productionSecrets.MERCADOPAGO_WEBHOOK_SECRET}

# ===== CORS =====
ALLOWED_ORIGINS=https://tu-frontend.com,https://tu-dominio.com

# ===== RATE LIMITING =====
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_STRICT_MAX=100

# ===== MERCADOPAGO =====
# CAMBIAR POR TUS CREDENCIALES REALES DE PRODUCCIÓN
MP_ACCESS_TOKEN=PROD-tu-access-token-real-aqui

# ===== LOGS =====
LOG_LEVEL=info
LOG_MAX_FILES=7d
LOG_MAX_SIZE=50m

# ===== ARCHIVOS =====
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# ===== HEALTH CHECK =====
HEALTH_ALLOW_DEGRADED=false
`;

fs.writeFileSync('.env.production', productionEnv);

// 3. Actualizar package.json para producción
console.log('📦 Actualizando package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Agregar engines si no existen
if (!packageJson.engines) {
  packageJson.engines = {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  };
}

// Agregar scripts de producción
packageJson.scripts = {
  ...packageJson.scripts,
  "start": "node server.js",
  "build": "echo 'No build step required for Node.js'",
  "deploy:setup": "npm run db:schema && npm run db:upgrade && npm run db:indexes && npm run db:upgrade-tickets",
  "deploy:migrate": "npm run db:schema && npm run db:upgrade && npm run db:indexes",
  "prod:logs": "tail -f logs/*.log",
  "prod:health": "curl $BASE_URL/health"
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

// 4. Crear archivo de configuración para Railway
console.log('🚂 Creando configuración Railway...');
const railwayConfig = {
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
};

fs.writeFileSync('railway.json', JSON.stringify(railwayConfig, null, 2));

// 5. Crear Dockerfile (opcional para otras plataformas)
console.log('🐳 Creando Dockerfile...');
const dockerfile = `# Usar Node.js LTS
FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear directorio de logs
RUN mkdir -p logs

# Crear directorio de uploads
RUN mkdir -p uploads

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["npm", "start"]
`;

fs.writeFileSync('Dockerfile', dockerfile);

// 6. Crear .dockerignore
console.log('📁 Creando .dockerignore...');
const dockerignore = `node_modules
npm-debug.log
.env
.env.local
.git
.gitignore
README.md
Dockerfile
.dockerignore
logs/*
uploads/*
*.log
.DS_Store
`;

fs.writeFileSync('.dockerignore', dockerignore);

// 7. Crear script de inicialización de BD para producción
console.log('🗄️ Creando script de inicialización de BD...');
const initScript = `#!/usr/bin/env node

/**
 * Script de inicialización de base de datos para producción
 */

const { execSync } = require('child_process');

async function initializeDatabase() {
  console.log('🗄️ Inicializando base de datos en producción...');
  
  try {
    // Ejecutar migraciones en orden
    console.log('📋 Ejecutando schema...');
    execSync('npm run db:schema', { stdio: 'inherit' });
    
    console.log('⬆️ Ejecutando upgrades...');
    execSync('npm run db:upgrade', { stdio: 'inherit' });
    
    console.log('📊 Creando índices...');
    execSync('npm run db:indexes', { stdio: 'inherit' });
    
    console.log('🎫 Configurando sistema de tickets...');
    execSync('npm run db:upgrade-tickets', { stdio: 'inherit' });
    
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    process.exit(1);
  }
}

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
`;

fs.writeFileSync('scripts/init-production-db.js', initScript);

// 8. Mostrar resumen
console.log('\n🎉 CONFIGURACIÓN DE PRODUCCIÓN COMPLETADA\n');

console.log('📋 ARCHIVOS CREADOS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ .env.production - Variables de entorno de producción');
console.log('✅ railway.json - Configuración Railway');
console.log('✅ Dockerfile - Para despliegue en contenedores');
console.log('✅ .dockerignore - Archivos a ignorar en Docker');
console.log('✅ scripts/init-production-db.js - Inicialización de BD');
console.log('✅ package.json actualizado con scripts de producción');

console.log('\n🔑 SECRETOS GENERADOS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ JWT_SECRET: Generado automáticamente');
console.log('✅ SESSION_SECRET: Generado automáticamente');
console.log('✅ MERCADOPAGO_WEBHOOK_SECRET: Generado automáticamente');

console.log('\n🚀 PRÓXIMOS PASOS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. Editar .env.production con tus valores reales:');
console.log('   - BASE_URL (tu dominio real)');
console.log('   - ALLOWED_ORIGINS (tu frontend)');
console.log('   - MP_ACCESS_TOKEN (credenciales reales de MercadoPago)');
console.log('');
console.log('2. Subir código a GitHub');
console.log('3. Conectar con Railway/Render');
console.log('4. Configurar variables de entorno en la plataforma');
console.log('5. Desplegar y probar');

console.log('\n📚 DOCUMENTACIÓN:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Ver: docs/DEPLOYMENT_GUIDE.md');

console.log('\n🔒 IMPORTANTE:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚠️  NO subir .env.production a GitHub');
console.log('⚠️  Configurar variables en el dashboard de la plataforma');
console.log('⚠️  Usar credenciales REALES de MercadoPago en producción');

console.log('\n✅ ¡Listo para desplegar en producción! 🚀\n');
