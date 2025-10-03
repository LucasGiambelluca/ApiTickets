const http = require('http');
const https = require('https');

// Función para hacer requests HTTP
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
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

// Lista de endpoints para testear
const endpoints = [
  // Health checks
  { method: 'GET', path: '/health', description: 'Health check principal' },
  { method: 'GET', path: '/api/health', description: 'Health check de API' },
  
  // Events endpoints
  { method: 'GET', path: '/api/events', description: 'Listar eventos' },
  { method: 'GET', path: '/api/events?page=1&limit=10', description: 'Listar eventos con paginación' },
  { method: 'GET', path: '/api/events/search?q=test', description: 'Buscar eventos' },
  { method: 'GET', path: '/api/events/1', description: 'Obtener evento específico' },
  { method: 'POST', path: '/api/events', description: 'Crear evento', data: { name: 'Test Event', startsAt: '2025-12-15T20:00:00Z', description: 'Test Description' } },
  
  // Venues endpoints
  { method: 'GET', path: '/api/venues', description: 'Listar venues' },
  { method: 'GET', path: '/api/venues/search?q=test', description: 'Buscar venues' },
  { method: 'GET', path: '/api/venues/1', description: 'Obtener venue específico' },
  { method: 'POST', path: '/api/venues', description: 'Crear venue', data: { name: 'Test Venue', address: 'Test Address 123', city: 'Test City', max_capacity: 1000 } },
  
  // Admin endpoints
  { method: 'GET', path: '/api/admin/settings/mercadopago', description: 'Configuración MercadoPago' },
  { method: 'POST', path: '/api/admin/settings/mercadopago/test', description: 'Test conexión MercadoPago' },
  { method: 'GET', path: '/api/admin/settings/fixed-fee', description: 'Configuración tarifas' },
  
  // Ticket Types endpoints
  { method: 'GET', path: '/api/ticket-types/event/1', description: 'Tipos de tickets por evento' },
  { method: 'POST', path: '/api/ticket-types', description: 'Crear tipo de ticket', data: { event_id: 1, name: 'General', price: 1000 } },
  
  // Reports endpoints
  { method: 'GET', path: '/api/reports', description: 'Dashboard general' },
  { method: 'GET', path: '/api/reports/event/1', description: 'Reporte de evento específico' },
  
  // Queue endpoints
  { method: 'GET', path: '/api/queue/status', description: 'Estado de cola' },
  
  // Orders endpoints
  { method: 'POST', path: '/api/orders', description: 'Crear orden', data: { event_id: 1, tickets: [{ type_id: 1, quantity: 2 }] } },
  
  // Payments endpoints
  { method: 'GET', path: '/api/payments/status/1', description: 'Estado de pago' },
  
  // Shows endpoints
  { method: 'GET', path: '/api/shows/1/seats', description: 'Asientos de show' },
];

async function testAllEndpoints() {
  console.log('🧪 INICIANDO PRUEBAS DE ENDPOINTS DE TICKETERA API');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Testeando: ${endpoint.method} ${endpoint.path}`);
      console.log(`   Descripción: ${endpoint.description}`);
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: endpoint.path,
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const startTime = Date.now();
      const response = await makeRequest(options, endpoint.data);
      const duration = Date.now() - startTime;
      
      results.push({
        endpoint: endpoint,
        response: response,
        duration: duration,
        timestamp: new Date().toISOString()
      });
      
      console.log(`   ✅ Status: ${response.statusCode}`);
      console.log(`   ⏱️  Tiempo: ${duration}ms`);
      if (response.body) {
        console.log(`   📄 Respuesta: ${JSON.stringify(response.body).substring(0, 200)}${JSON.stringify(response.body).length > 200 ? '...' : ''}`);
      } else if (response.rawBody) {
        console.log(`   📄 Respuesta (raw): ${response.rawBody.substring(0, 200)}${response.rawBody.length > 200 ? '...' : ''}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        endpoint: endpoint,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Pequeña pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Generar informe final
  console.log('\n' + '=' .repeat(60));
  console.log('📊 INFORME DETALLADO DE RESULTADOS');
  console.log('=' .repeat(60));
  
  const successCount = results.filter(r => r.response && r.response.statusCode < 400).length;
  const errorCount = results.filter(r => r.error || (r.response && r.response.statusCode >= 400)).length;
  
  console.log(`\n📈 RESUMEN GENERAL:`);
  console.log(`   Total endpoints testeados: ${results.length}`);
  console.log(`   Exitosos (2xx-3xx): ${successCount}`);
  console.log(`   Con errores (4xx-5xx): ${errorCount}`);
  console.log(`   Tasa de éxito: ${((successCount / results.length) * 100).toFixed(1)}%`);
  
  console.log(`\n📋 DETALLE POR ENDPOINT:`);
  
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.endpoint.method} ${result.endpoint.path}`);
    console.log(`   Descripción: ${result.endpoint.description}`);
    
    if (result.error) {
      console.log(`   ❌ ERROR: ${result.error}`);
    } else if (result.response) {
      const status = result.response.statusCode;
      const icon = status < 400 ? '✅' : '❌';
      console.log(`   ${icon} Status: ${status}`);
      console.log(`   ⏱️  Duración: ${result.duration}ms`);
      
      if (result.response.body) {
        console.log(`   📄 Respuesta:`);
        console.log(`      ${JSON.stringify(result.response.body, null, 2).split('\n').join('\n      ')}`);
      } else if (result.response.rawBody) {
        console.log(`   📄 Respuesta (texto):`);
        console.log(`      ${result.response.rawBody}`);
      }
    }
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 PRUEBAS COMPLETADAS');
  console.log('=' .repeat(60));
  
  return results;
}

// Ejecutar las pruebas
testAllEndpoints().catch(console.error);
