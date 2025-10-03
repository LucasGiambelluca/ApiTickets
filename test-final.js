#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE TESTING FINAL - VERIFICACIÓN COMPLETA DE CORRECCIONES
 * 
 * Este script verifica que todas las correcciones aplicadas funcionen correctamente
 */

const http = require('http');

// Función para hacer requests HTTP
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody,
            rawBody: body
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: body,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Tests organizados por categoría
const testSuites = {
  'Health Checks': [
    { method: 'GET', path: '/health', description: 'Health check principal (debe ser <500ms)' },
    { method: 'GET', path: '/api/health', description: 'Health check de API' },
  ],
  
  'Endpoints con DB (deben devolver errores amigables)': [
    { method: 'GET', path: '/api/events', description: 'Listar eventos' },
    { method: 'GET', path: '/api/venues', description: 'Listar venues' },
    { method: 'GET', path: '/api/ticket-types/events/1/ticket-types', description: 'Tipos de tickets' },
  ],
  
  'Validaciones (payloads corregidos)': [
    { method: 'POST', path: '/api/events', description: 'Crear evento', data: { name: 'Test Event', startsAt: '2025-12-15T20:00:00Z' } },
    { method: 'POST', path: '/api/venues', description: 'Crear venue', data: { name: 'Test Venue', address: 'Test Address', city: 'Test City', max_capacity: 1000 } },
  ],
  
  'Rutas montadas (antes daban 404)': [
    { method: 'GET', path: '/api/ticket-types/events/1/ticket-types', description: 'Ticket types por evento' },
    { method: 'GET', path: '/api/queue/status', description: 'Estado de cola' },
    { method: 'GET', path: '/api/reports', description: 'Dashboard de reportes' },
  ]
};

async function runTestSuite() {
  console.log('🧪 VERIFICACIÓN FINAL DE CORRECCIONES - API TICKETERA');
  console.log('=' .repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  const results = {};
  
  for (const [suiteName, tests] of Object.entries(testSuites)) {
    console.log(`\n📋 ${suiteName}`);
    console.log('-' .repeat(40));
    
    results[suiteName] = [];
    
    for (const test of tests) {
      totalTests++;
      
      try {
        const options = {
          hostname: 'localhost',
          port: 3000,
          path: test.path,
          method: test.method,
          headers: {
            'Content-Type': 'application/json',
          }
        };
        
        const startTime = Date.now();
        const response = await makeRequest(options, test.data);
        const duration = Date.now() - startTime;
        
        // Evaluar el resultado según el tipo de test
        let testPassed = false;
        let reason = '';
        
        if (suiteName === 'Health Checks') {
          testPassed = response.statusCode === 200;
          reason = testPassed ? `✅ OK (${duration}ms)` : `❌ Status ${response.statusCode}`;
          
          // Verificar que health check sea rápido
          if (test.path === '/health' && duration > 500) {
            testPassed = false;
            reason = `❌ Muy lento (${duration}ms > 500ms)`;
          }
        } 
        else if (suiteName.includes('DB')) {
          // Debe devolver error amigable de DB
          testPassed = response.statusCode === 503 && 
                      response.body && 
                      response.body.code === 'DB_CONNECTION_REFUSED';
          reason = testPassed ? '✅ Error amigable de DB' : `❌ Status ${response.statusCode}`;
        }
        else if (suiteName.includes('Validaciones')) {
          // Debe intentar procesar (error de DB, no validación)
          testPassed = response.statusCode === 503;
          reason = testPassed ? '✅ Validación OK, error DB esperado' : `❌ Status ${response.statusCode}`;
        }
        else if (suiteName.includes('Rutas montadas')) {
          // No debe ser 404
          testPassed = response.statusCode !== 404;
          reason = testPassed ? '✅ Ruta montada' : '❌ Ruta no encontrada (404)';
        }
        
        if (testPassed) {
          passedTests++;
          console.log(`   ✅ ${test.description} - ${reason}`);
        } else {
          failedTests++;
          console.log(`   ❌ ${test.description} - ${reason}`);
        }
        
        results[suiteName].push({
          test: test,
          passed: testPassed,
          response: response,
          duration: duration,
          reason: reason
        });
        
      } catch (error) {
        failedTests++;
        console.log(`   ❌ ${test.description} - Error: ${error.message}`);
        
        results[suiteName].push({
          test: test,
          passed: false,
          error: error.message,
          reason: `Error: ${error.message}`
        });
      }
      
      // Pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Resumen final
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMEN DE VERIFICACIÓN');
  console.log('=' .repeat(60));
  
  console.log(`\n📈 ESTADÍSTICAS:`);
  console.log(`   Total de tests: ${totalTests}`);
  console.log(`   Tests exitosos: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`   Tests fallidos: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  
  // Verificar correcciones específicas
  console.log(`\n🔍 VERIFICACIÓN DE CORRECCIONES:`);
  
  // Health check rápido
  const healthTest = results['Health Checks']?.find(r => r.test.path === '/health');
  if (healthTest && healthTest.duration < 500) {
    console.log(`   ✅ Health check optimizado: ${healthTest.duration}ms < 500ms`);
  } else {
    console.log(`   ❌ Health check lento: ${healthTest?.duration || 'N/A'}ms`);
  }
  
  // Errores amigables de DB
  const dbErrors = Object.values(results).flat().filter(r => 
    r.response && r.response.statusCode === 503 && 
    r.response.body && r.response.body.code === 'DB_CONNECTION_REFUSED'
  );
  console.log(`   ✅ Errores amigables de DB: ${dbErrors.length} endpoints`);
  
  // Rutas no 404
  const non404Routes = Object.values(results).flat().filter(r => 
    r.response && r.response.statusCode !== 404
  );
  console.log(`   ✅ Rutas montadas correctamente: ${non404Routes.length}/${totalTests} endpoints`);
  
  console.log(`\n🎯 ESTADO GENERAL:`);
  if (passedTests >= totalTests * 0.8) {
    console.log(`   🎉 EXCELENTE: ${((passedTests/totalTests)*100).toFixed(1)}% de tests exitosos`);
    console.log(`   ✅ Las correcciones están funcionando correctamente`);
  } else if (passedTests >= totalTests * 0.6) {
    console.log(`   ⚠️  BUENO: ${((passedTests/totalTests)*100).toFixed(1)}% de tests exitosos`);
    console.log(`   🔧 Algunas correcciones necesitan ajustes`);
  } else {
    console.log(`   ❌ NECESITA TRABAJO: ${((passedTests/totalTests)*100).toFixed(1)}% de tests exitosos`);
    console.log(`   🚨 Las correcciones requieren revisión`);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 VERIFICACIÓN COMPLETADA');
  console.log('=' .repeat(60));
  
  return {
    totalTests,
    passedTests,
    failedTests,
    successRate: (passedTests/totalTests)*100,
    results
  };
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runTestSuite().catch(console.error);
}

module.exports = { runTestSuite };
