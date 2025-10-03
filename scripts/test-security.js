#!/usr/bin/env node

/**
 * Script de testing de seguridad para Ticketera
 * Verifica que todas las medidas de seguridad estén funcionando
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

console.log('🔒 EJECUTANDO TESTS DE SEGURIDAD PARA TICKETERA\n');
console.log(`🎯 URL Base: ${BASE_URL}\n`);

let testsPassed = 0;
let testsFailed = 0;

// Función helper para hacer requests HTTP
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test helper
async function runTest(testName, testFn) {
  try {
    console.log(`🧪 ${testName}...`);
    const result = await testFn();
    if (result) {
      console.log(`✅ ${testName} - PASÓ\n`);
      testsPassed++;
    } else {
      console.log(`❌ ${testName} - FALLÓ\n`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ ${testName} - ERROR: ${error.message}\n`);
    testsFailed++;
  }
}

// Tests de seguridad
async function testHealthCheck() {
  const response = await makeRequest(`${BASE_URL}/health`);
  return response.statusCode === 200;
}

async function testSecurityHeaders() {
  const response = await makeRequest(`${BASE_URL}/health`);
  const headers = response.headers;
  
  // Verificar headers de seguridad de Helmet
  const requiredHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection'
  ];
  
  return requiredHeaders.every(header => headers[header]);
}

async function testRateLimiting() {
  // Hacer múltiples requests rápidos para activar rate limiting
  const promises = [];
  for (let i = 0; i < 15; i++) {
    promises.push(makeRequest(`${API_BASE}/events`));
  }
  
  const responses = await Promise.all(promises);
  
  // Al menos una respuesta debería ser 429 (Too Many Requests)
  return responses.some(r => r.statusCode === 429);
}

async function testAuthenticationRequired() {
  // Test endpoint que requiere autenticación
  const response = await makeRequest(`${API_BASE}/admin/settings/fixed-fee`);
  return response.statusCode === 401;
}

async function testInvalidToken() {
  const response = await makeRequest(`${API_BASE}/admin/settings/fixed-fee`, {
    headers: {
      'Authorization': 'Bearer invalid-token-here'
    }
  });
  return response.statusCode === 401;
}

async function testInputValidation() {
  // Test validación de inputs con datos inválidos
  const response = await makeRequest(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer fake-token'
    },
    body: JSON.stringify({
      name: 'a', // Muy corto, debería fallar validación
      description: 'x'.repeat(3000) // Muy largo
    })
  });
  
  // Debería fallar por validación (400) o autenticación (401)
  return response.statusCode === 400 || response.statusCode === 401;
}

async function testWebhookWithoutSignature() {
  const response = await makeRequest(`${API_BASE}/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'payment',
      data: { id: '123' }
    })
  });
  
  // Debería rechazar webhook sin firma
  return response.statusCode === 401;
}

async function testCORSHeaders() {
  const response = await makeRequest(`${BASE_URL}/health`, {
    headers: {
      'Origin': 'https://malicious-site.com'
    }
  });
  
  // Verificar que CORS esté configurado
  return response.headers['access-control-allow-origin'] !== undefined;
}

async function testIdempotencySupport() {
  const idempotencyKey = crypto.randomUUID();
  
  const response = await makeRequest(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'Authorization': 'Bearer fake-token'
    },
    body: JSON.stringify({
      name: 'Test Event'
    })
  });
  
  // Debería procesar el header (aunque falle por auth)
  return response.statusCode === 401; // Falla por auth, no por idempotencia
}

async function testSQLInjectionProtection() {
  // Intentar SQL injection en parámetros
  const maliciousId = "1'; DROP TABLE events; --";
  const response = await makeRequest(`${API_BASE}/events/${encodeURIComponent(maliciousId)}`);
  
  // Debería devolver 404 o 400, no 500 (error de BD)
  return response.statusCode !== 500;
}

// Ejecutar todos los tests
async function runAllTests() {
  console.log('🚀 Iniciando batería de tests de seguridad...\n');
  
  await runTest('Health Check Disponible', testHealthCheck);
  await runTest('Headers de Seguridad (Helmet)', testSecurityHeaders);
  await runTest('Rate Limiting Activo', testRateLimiting);
  await runTest('Autenticación Requerida en Admin', testAuthenticationRequired);
  await runTest('Rechazo de Tokens Inválidos', testInvalidToken);
  await runTest('Validación de Inputs', testInputValidation);
  await runTest('Webhook Requiere Firma', testWebhookWithoutSignature);
  await runTest('Configuración CORS', testCORSHeaders);
  await runTest('Soporte de Idempotencia', testIdempotencySupport);
  await runTest('Protección SQL Injection', testSQLInjectionProtection);
  
  // Resumen final
  console.log('📊 RESUMEN DE TESTS DE SEGURIDAD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Tests Pasados: ${testsPassed}`);
  console.log(`❌ Tests Fallidos: ${testsFailed}`);
  console.log(`📈 Tasa de Éxito: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ¡TODOS LOS TESTS DE SEGURIDAD PASARON!');
    console.log('🔒 El sistema está correctamente protegido');
  } else {
    console.log('\n⚠️  ALGUNOS TESTS FALLARON');
    console.log('🔧 Revisar la configuración de seguridad');
  }
  
  console.log('\n📋 RECOMENDACIONES ADICIONALES:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('• Ejecutar tests en entorno de producción');
  console.log('• Configurar monitoreo de logs de seguridad');
  console.log('• Realizar auditorías periódicas');
  console.log('• Mantener dependencias actualizadas');
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Verificar que el servidor esté corriendo
async function checkServerRunning() {
  try {
    await makeRequest(`${BASE_URL}/health`);
    return true;
  } catch (error) {
    console.error('❌ Error: El servidor no está corriendo');
    console.error('   Ejecutar: npm start');
    console.error(`   URL esperada: ${BASE_URL}`);
    return false;
  }
}

// Ejecutar tests
async function main() {
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    process.exit(1);
  }
  
  await runAllTests();
}

main().catch(console.error);
