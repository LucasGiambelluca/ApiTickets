#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎫 Ticketera Setup Script');
console.log('========================\n');

// Verificar Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Node.js 16 or higher is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log('✅ Node.js version:', nodeVersion);

// Verificar si .env existe
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found. Please copy and configure .env file first.');
  process.exit(1);
}

console.log('✅ .env file found');

// Función para ejecutar comandos
function runCommand(command, description) {
  try {
    console.log(`\n🔄 ${description}...`);
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

// Verificar servicios externos
function checkService(command, serviceName) {
  try {
    execSync(command, { stdio: 'pipe' });
    console.log(`✅ ${serviceName} is available`);
    return true;
  } catch (error) {
    console.log(`⚠️  ${serviceName} is not available or not running`);
    return false;
  }
}

console.log('\n📋 Checking external services...');

// Verificar MySQL
const mysqlAvailable = checkService('mysql --version', 'MySQL');

// Verificar Redis
const redisAvailable = checkService('redis-cli ping', 'Redis');

if (!mysqlAvailable) {
  console.log('\n📝 MySQL Setup Instructions:');
  console.log('   - Install MySQL/MariaDB');
  console.log('   - Start the service');
  console.log('   - Update DB_* variables in .env');
}

if (!redisAvailable) {
  console.log('\n📝 Redis Setup Instructions:');
  console.log('   - Install Redis');
  console.log('   - Start Redis server: redis-server');
  console.log('   - Or use Docker: docker run -d -p 6379:6379 redis:alpine');
}

// Instalar dependencias
runCommand('npm install', 'Installing dependencies');

// Configurar base de datos si MySQL está disponible
if (mysqlAvailable) {
  console.log('\n🗄️  Setting up database...');
  
  try {
    // Crear usuario de base de datos
    runCommand('node scripts/db-create-user.js', 'Creating database user');
    
    // Crear esquema
    runCommand('npm run db:schema', 'Creating database schema');
    
    // Ejecutar upgrade
    runCommand('node scripts/db-import.js sql/upgrade_venues_producers_sections.sql', 'Applying database upgrades');
    
    // Cargar datos de prueba
    const loadSeedData = process.argv.includes('--seed');
    if (loadSeedData) {
      runCommand('npm run db:seed', 'Loading seed data');
    }
    
  } catch (error) {
    console.log('⚠️  Database setup failed. You may need to configure it manually.');
    console.log('   Check your database credentials in .env file');
  }
} else {
  console.log('\n⚠️  Skipping database setup (MySQL not available)');
}

// Verificar configuración de MercadoPago
const envContent = fs.readFileSync(envPath, 'utf8');
const hasMPToken = envContent.includes('MP_ACCESS_TOKEN=') && 
                   !envContent.includes('MP_ACCESS_TOKEN=your_mercadopago_access_token_here');

if (!hasMPToken) {
  console.log('\n💳 MercadoPago Configuration Needed:');
  console.log('   1. Create account at https://developers.mercadopago.com');
  console.log('   2. Get your Access Token and Public Key');
  console.log('   3. Update MP_* variables in .env file');
}

console.log('\n🎉 Setup completed!');
console.log('\n📋 Next steps:');

if (!mysqlAvailable) {
  console.log('   1. Install and configure MySQL/MariaDB');
  console.log('   2. Run: node scripts/db-create-user.js');
  console.log('   3. Run: npm run db:schema');
  console.log('   4. Run: node scripts/db-import.js sql/upgrade_venues_producers_sections.sql');
}

if (!redisAvailable) {
  console.log('   1. Install and start Redis server');
}

if (!hasMPToken) {
  console.log('   1. Configure MercadoPago credentials in .env');
}

console.log('   2. Start the application: npm start');
console.log('   3. Visit: http://localhost:3000/health');

console.log('\n📚 Documentation: README.md');
console.log('🐛 Issues: Check logs and troubleshooting section in README.md');

console.log('\n🚀 Ready to launch Ticketera!');
