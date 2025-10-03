const fs = require('fs');
const path = require('path');

// Leer los datos de prueba
const testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'create-test-data.json'), 'utf8'));

async function createTestEvents() {
    console.log('Creando eventos de prueba...');
    
    for (let i = 0; i < testData.length; i++) {
        const event = testData[i];
        
        try {
            const response = await fetch('http://localhost:3000/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Evento creado: ${result.name} en ${result.venue} (ID: ${result.eventId})`);
            } else {
                const error = await response.json();
                console.error(`❌ Error creando evento ${event.name}:`, error);
            }
        } catch (error) {
            console.error(`❌ Error de conexión creando evento ${event.name}:`, error.message);
        }
        
        // Pequeña pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 Proceso completado!');
    
    // Verificar eventos creados
    try {
        const response = await fetch('http://localhost:3000/api/events?status=all');
        const data = await response.json();
        console.log(`\n📊 Total de eventos en la base de datos: ${data.events.length}`);
        
        // Mostrar venues únicos
        const venues = [...new Set(data.events.map(e => e.venue).filter(v => v))];
        console.log(`🏢 Venues disponibles: ${venues.join(', ')}`);
        
    } catch (error) {
        console.error('Error verificando eventos:', error.message);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    createTestEvents().catch(console.error);
}

module.exports = { createTestEvents };
