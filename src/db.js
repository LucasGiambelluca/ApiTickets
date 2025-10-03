require('dotenv').config();
const mysql = require('mysql2/promise');
const { createRetryManager } = require('./utils/retry');

// Configuración optimizada del pool de conexiones con timeouts agresivos
const poolConfig = {
  host: process.env.DB_HOST || '127.0.0.1', // Usar IPv4 explícitamente para Laragon
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ticketera',
  
  // Configuración del pool optimizada con timeouts cortos
  waitForConnections: true,
  connectionLimit: 10, // Reducido para evitar sobrecarga
  queueLimit: 0, // Sin límite de cola
  acquireTimeout: 5000, // 5 segundos timeout (reducido)
  timeout: 10000, // 10 segundos query timeout (reducido)
  
  // Configuración de reconexión
  reconnect: true,
  idleTimeout: 300000, // 5 minutos
  maxIdle: 10, // Máximo 10 conexiones idle
  
  // Configuración de timezone y charset
  timezone: 'Z',
  charset: 'utf8mb4',
  
  // Configuraciones adicionales de performance
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: false,
  
  // SSL configuration (para producción)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
};

const pool = mysql.createPool(poolConfig);

// Retry manager para operaciones de base de datos
const dbRetryManager = createRetryManager.database();

// Wrapper para operaciones de base de datos con reintentos
class DatabaseManager {
  constructor(pool) {
    this.pool = pool;
    this.retryManager = dbRetryManager;
  }

  async query(sql, params = []) {
    return await this.retryManager.execute(async () => {
      return await this.pool.execute(sql, params);
    });
  }

  async getConnection() {
    return await this.retryManager.execute(async () => {
      return await this.pool.getConnection();
    });
  }

  async transaction(callback) {
    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  // Health check para la base de datos con timeout rápido
  async healthCheck(timeoutMs = 2000) {
    try {
      // Crear una promesa con timeout
      const healthPromise = this.pool.execute('SELECT 1 as health');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
      );
      
      const [rows] = await Promise.race([healthPromise, timeoutPromise]);
      return rows[0].health === 1;
    } catch (error) {
      console.error('Database health check failed:', error.message);
      return false;
    }
  }

  // Obtener estadísticas del pool
  getPoolStats() {
    return {
      totalConnections: this.pool._allConnections ? this.pool._allConnections.length : 0,
      freeConnections: this.pool._freeConnections ? this.pool._freeConnections.length : 0,
      acquiringConnections: this.pool._acquiringConnections ? this.pool._acquiringConnections.length : 0,
      connectionLimit: poolConfig.connectionLimit
    };
  }

  async close() {
    await this.pool.end();
  }
}

// Event listeners para monitoreo
pool.on('connection', (connection) => {
  console.log('🟢 New DB connection established:', connection.threadId);
});

pool.on('error', (err) => {
  console.error('🔴 Database pool error:', err);
});

pool.on('release', (connection) => {
  console.log('🔄 DB connection released:', connection.threadId);
});

// Crear instancia del manager
const dbManager = new DatabaseManager(pool);

// Verificar conexión inicial
(async () => {
  try {
    const isHealthy = await dbManager.healthCheck();
    if (isHealthy) {
      console.log('✅ Database connection established successfully');
    } else {
      console.error('❌ Database health check failed');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
})();

module.exports = { 
  pool, 
  db: dbManager,
  // Mantener compatibilidad con código existente
  query: (sql, params) => dbManager.query(sql, params),
  getConnection: () => dbManager.getConnection(),
  transaction: (callback) => dbManager.transaction(callback)
};
