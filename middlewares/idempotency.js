const { client: redisClient, isConnected } = require('../src/redis');
const crypto = require('crypto');

/**
 * Middleware de idempotencia para operaciones críticas
 * Previene ejecución duplicada de operaciones (reservas, pagos, etc)
 */
function idempotency(options = {}) {
  const ttl = options.ttl || 86400; // 24 horas por defecto
  const keyPrefix = options.keyPrefix || 'idempotency:';

  return async (req, res, next) => {
    // Obtener clave de idempotencia del header
    const idempotencyKey = req.headers['idempotency-key'] || 
                          req.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      // Si no hay clave, generar una basada en el contenido
      const autoKey = generateIdempotencyKey(req);
      req.idempotencyKey = autoKey;
      
      // Para POST críticos sin clave, advertir pero continuar
      if (req.method === 'POST') {
        console.warn('POST sin idempotency-key:', {
          path: req.path,
          autoKey
        });
      }
      return next();
    }

    if (!isConnected()) {
      console.warn('Redis no disponible para idempotencia');
      req.idempotencyKey = idempotencyKey;
      return next();
    }

    try {
      const redisKey = keyPrefix + idempotencyKey;
      
      // Verificar si ya existe una respuesta guardada
      const cachedResponse = await redisClient.get(redisKey);

      if (cachedResponse) {
        // Ya se procesó esta operación, devolver respuesta guardada
        const response = JSON.parse(cachedResponse);
        console.log('Operación idempotente detectada:', {
          key: idempotencyKey,
          path: req.path
        });
        
        return res.status(response.statusCode).json(response.body);
      }

      // Guardar la clave para uso posterior
      req.idempotencyKey = idempotencyKey;

      // Interceptar la respuesta para guardarla
      const originalJson = res.json;
      res.json = function(body) {
        // Guardar respuesta en Redis solo si fue exitosa (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseData = {
            statusCode: res.statusCode,
            body
          };
          
          redisClient.setex(redisKey, ttl, JSON.stringify(responseData))
            .catch(err => console.error('Error guardando idempotencia:', err));
        }

        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      console.error('Error en middleware de idempotencia:', error);
      next();
    }
  };
}

/**
 * Genera una clave de idempotencia automática basada en el request
 */
function generateIdempotencyKey(req) {
  const data = {
    method: req.method,
    path: req.path,
    body: req.body,
    userId: req.user?.userId,
    ip: req.ip
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');

  return `auto:${hash.substring(0, 32)}`;
}

/**
 * Middleware específico para operaciones de reserva
 */
const reservationIdempotency = idempotency({
  ttl: 900, // 15 minutos (tiempo de vida de reserva)
  keyPrefix: 'idempotency:reservation:'
});

/**
 * Middleware específico para operaciones de pago
 */
const paymentIdempotency = idempotency({
  ttl: 86400, // 24 horas
  keyPrefix: 'idempotency:payment:'
});

/**
 * Middleware específico para unirse a cola
 */
const queueJoinIdempotency = idempotency({
  ttl: 3600, // 1 hora
  keyPrefix: 'idempotency:queue:'
});

module.exports = {
  idempotency,
  reservationIdempotency,
  paymentIdempotency,
  queueJoinIdempotency,
  generateIdempotencyKey
};
