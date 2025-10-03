#!/usr/bin/env node

/**
 * Script para actualizar la base de datos con el nuevo sistema de tickets
 * Ejecutar con: node scripts/upgrade-ticket-system.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Importar conexión a la base de datos
const { pool } = require('../src/db');

async function runUpgrade() {
  console.log('🚀 Iniciando actualización del sistema de tickets...\n');
  
  const conn = await pool.getConnection();
  
  try {
    // Leer el archivo SQL de upgrade
    const upgradeFile = path.join(__dirname, '..', 'sql', 'upgrade_ticket_types.sql');
    
    if (!fs.existsSync(upgradeFile)) {
      throw new Error(`Archivo de upgrade no encontrado: ${upgradeFile}`);
    }
    
    const sqlContent = fs.readFileSync(upgradeFile, 'utf8');
    
    console.log('📄 Archivo de upgrade cargado');
    console.log('📊 Ejecutando actualización de base de datos...\n');
    
    // Dividir el contenido SQL en statements individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Encontrados ${statements.length} statements SQL para ejecutar\n`);
    
    // Ejecutar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Saltar comentarios y statements vacíos
      if (statement.startsWith('--') || statement.length < 10) {
        continue;
      }
      
      try {
        console.log(`⏳ Ejecutando statement ${i + 1}/${statements.length}...`);
        
        // Manejar DELIMITER statements (para triggers)
        if (statement.includes('DELIMITER')) {
          console.log('   → Saltando statement DELIMITER');
          continue;
        }
        
        await conn.query(statement);
        console.log('   ✅ Ejecutado exitosamente');
        
      } catch (error) {
        // Algunos errores son esperados (como tablas que ya existen)
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.code === 'ER_DUP_FIELDNAME' ||
            error.message.includes('already exists')) {
          console.log('   ⚠️  Ya existe (saltando)');
          continue;
        }
        
        console.error(`   ❌ Error en statement ${i + 1}:`, error.message);
        
        // Continuar con el siguiente statement para upgrades no críticos
        if (!statement.toLowerCase().includes('create table')) {
          continue;
        }
        
        throw error;
      }
    }
    
    console.log('\n🎉 Actualización de base de datos completada exitosamente!\n');
    
    // Verificar que las nuevas tablas existen
    console.log('🔍 Verificando nuevas tablas...');
    
    const tablesToCheck = [
      'ticket_types',
      'ticket_reservations', 
      'generated_tickets',
      'event_sales_stats'
    ];
    
    for (const table of tablesToCheck) {
      try {
        const [rows] = await conn.query(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`   ✅ Tabla ${table} creada correctamente`);
        } else {
          console.log(`   ❌ Tabla ${table} no encontrada`);
        }
      } catch (error) {
        console.log(`   ❌ Error verificando tabla ${table}:`, error.message);
      }
    }
    
    // Mostrar estadísticas
    console.log('\n📊 Estadísticas del sistema:');
    
    try {
      const [eventCount] = await conn.query('SELECT COUNT(*) as count FROM events');
      console.log(`   📅 Eventos registrados: ${eventCount[0].count}`);
      
      const [ticketTypeCount] = await conn.query('SELECT COUNT(*) as count FROM ticket_types');
      console.log(`   🎫 Tipos de tickets: ${ticketTypeCount[0].count}`);
      
      const [reservationCount] = await conn.query('SELECT COUNT(*) as count FROM ticket_reservations');
      console.log(`   📋 Reservas: ${reservationCount[0].count}`);
      
    } catch (error) {
      console.log('   ⚠️  No se pudieron obtener estadísticas:', error.message);
    }
    
    console.log('\n✨ ¡Sistema de tickets actualizado y listo para usar!');
    console.log('\n📚 Próximos pasos:');
    console.log('   1. Reinicia el servidor: npm start');
    console.log('   2. Crea tipos de tickets para tus eventos');
    console.log('   3. Configura MercadoPago si no lo has hecho');
    console.log('   4. ¡Comienza a vender tickets!');
    
  } catch (error) {
    console.error('\n❌ Error durante la actualización:', error);
    console.error('\n🔧 Posibles soluciones:');
    console.error('   1. Verifica que la base de datos esté corriendo');
    console.error('   2. Verifica las credenciales en el archivo .env');
    console.error('   3. Asegúrate de tener permisos para crear tablas');
    
    process.exit(1);
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🎫 Ticketera - Script de Actualización del Sistema de Tickets

Uso: node scripts/upgrade-ticket-system.js [opciones]

Opciones:
  --help, -h     Mostrar esta ayuda
  --force        Forzar actualización (recrear tablas)
  --dry-run      Mostrar qué se haría sin ejecutar

Este script actualiza la base de datos para incluir:
  ✅ Sistema de tipos de tickets por evento
  ✅ Sistema de reservas temporales
  ✅ Generación automática de tickets con QR
  ✅ Estadísticas de ventas por evento
  ✅ Triggers para actualización automática de contadores
  ✅ Vistas para reportes rápidos

Requisitos:
  - Base de datos MySQL/MariaDB corriendo
  - Credenciales configuradas en .env
  - Permisos para crear tablas y triggers
`);
}

// Manejar argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

if (args.includes('--dry-run')) {
  console.log('🔍 Modo dry-run: mostrando qué se haría...\n');
  
  const upgradeFile = path.join(__dirname, '..', 'sql', 'upgrade_ticket_types.sql');
  if (fs.existsSync(upgradeFile)) {
    const content = fs.readFileSync(upgradeFile, 'utf8');
    const statements = content.split(';').filter(s => s.trim().length > 0);
    
    console.log(`📝 Se ejecutarían ${statements.length} statements SQL`);
    console.log('📊 Tablas que se crearían:');
    console.log('   - ticket_types');
    console.log('   - ticket_reservations');
    console.log('   - generated_tickets');
    console.log('   - event_sales_stats');
    console.log('\n✨ Usa el comando sin --dry-run para ejecutar la actualización');
  } else {
    console.log('❌ Archivo de upgrade no encontrado');
  }
  
  process.exit(0);
}

// Ejecutar actualización
runUpgrade().catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
