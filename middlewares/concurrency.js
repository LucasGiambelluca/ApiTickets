const { client: redisClient, isConnected } = require('../src/redis');

/**
 * Middleware de lock distribuido para prevenir race conditions
 * Útil para operaciones críticas como reservas, ventas, etc.
 */
function distributedLock(options = {}) {
  const ttl = options.ttl || 30; // 30 segundos por defecto
  const keyPrefix = options.keyPrefix || 'lock:';
  const retryDelay = options.retryDelay || 100; // 100ms
  const maxRetries = options.maxRetries || 10;

  return async (req, res, next) => {
    // Generar clave de lock basada en la operación
    const lockKey = keyPrefix + generateLockKey(req, options);
    
    if (!isConnected()) {
      console.warn('Redis no disponible para lock distribuido');
      return next();
    }

    let acquired = false;
    let retries = 0;

    try {
      // Intentar adquirir el lock
      while (!acquired && retries < maxRetries) {
        const result = await redisClient.set(lockKey, Date.now(), {
          PX: ttl * 1000, // TTL en milisegundos
          NX: true // Solo si no existe
        });

        if (result === 'OK') {
          acquired = true;
          req.lockKey = lockKey;
          break;
        }

        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retries++;
      }

      if (!acquired) {
        return res.status(409).json({
          error: 'ResourceLocked',
          message: 'Recurso temporalmente bloqueado, intenta de nuevo'
        });
      }

      // Interceptar el final de la respuesta para liberar el lock
      const originalSend = res.send;
      res.send = function(data) {
        releaseLock(lockKey);
        return originalSend.call(this, data);
      };

      // También liberar en caso de error
      const originalNext = next;
      next = function(error) {
        if (error) {
          releaseLock(lockKey);
        }
        return originalNext(error);
      };

      next();
    } catch (error) {
      console.error('Error en distributed lock:', error);
      if (acquired) {
        await releaseLock(lockKey);
      }
      next(error);
    }
  };
}

/**
 * Genera una clave de lock única para la operación
 */
function generateLockKey(req, options) {
  if (options.keyGenerator) {
    return options.keyGenerator(req);
  }

  // Clave por defecto basada en ruta y parámetros críticos
  const parts = [req.method, req.route?.path || req.path];
  
  // Agregar parámetros relevantes
  if (req.params.id) parts.push(`id:${req.params.id}`);
  if (req.params.showId) parts.push(`show:${req.params.showId}`);
  if (req.params.eventId) parts.push(`event:${req.params.eventId}`);
  if (req.user?.userId) parts.push(`user:${req.user.userId}`);

  return parts.join(':');
}

/**
 * Libera un lock distribuido
 */
async function releaseLock(lockKey) {
  if (!isConnected()) return;

  try {
    await redisClient.del(lockKey);
  } catch (error) {
    console.error('Error liberando lock:', error);
  }
}

/**
 * Lock específico para operaciones de reserva
 * Previene overselling de tickets
 */
const reservationLock = distributedLock({
  ttl: 15, // 15 segundos
  keyPrefix: 'lock:reservation:',
  keyGenerator: (req) => {
    return `${req.body.showId || req.params.showId}:${req.body.ticketTypeId}`;
  }
});

/**
 * Lock específico para procesamiento de pagos
 */
const paymentLock = distributedLock({
  ttl: 60, // 1 minuto
  keyPrefix: 'lock:payment:',
  keyGenerator: (req) => {
    return req.params.orderId || req.body.orderId || 'unknown';
  }
});

/**
 * Lock específico para operaciones de cola
 */
const queueLock = distributedLock({
  ttl: 10, // 10 segundos
  keyPrefix: 'lock:queue:',
  keyGenerator: (req) => {
    return `${req.params.showId}:${req.user?.userId || req.ip}`;
  }
});

/**
 * Middleware de control de transacciones de base de datos
 * Asegura que las operaciones críticas se ejecuten en transacción
 */
function requireTransaction(req, res, next) {
  const { db } = require('../src/db');
  
  // Crear una transacción y agregarla al request
  req.transaction = async (callback) => {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Ejecutar callback con la conexión transaccional
      const result = await callback(connection);
      
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

  next();
}

/**
 * Middleware para operaciones atómicas con Redis
 */
function atomicRedisOperation(req, res, next) {
  if (!isConnected()) {
    return next();
  }

  // Crear un pipeline para operaciones atómicas
  req.redisPipeline = redisClient.multi();
  
  // Interceptar respuesta para ejecutar pipeline
  const originalSend = res.send;
  res.send = function(data) {
    // Solo ejecutar si hay operaciones pendientes
    if (req.redisPipeline && req.redisPipeline.queue.length > 0) {
      req.redisPipeline.exec()
        .catch(err => console.error('Error en pipeline Redis:', err));
    }
    return originalSend.call(this, data);
  };

  next();
}

module.exports = {
  distributedLock,
  reservationLock,
  paymentLock,
  queueLock,
  requireTransaction,
  atomicRedisOperation,
  releaseLock
};
