const rateLimit = require('express-rate-limit');
const { client: redisClient, isConnected } = require('../src/redis');

/**
 * Store personalizado para rate limiting usando Redis
 */
class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.resetExpiryOnChange = options.resetExpiryOnChange || false;
  }

  async increment(key) {
    const redisKey = this.prefix + key;
    
    if (!isConnected()) {
      // Fallback: permitir request si Redis no está disponible
      return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
    }

    try {
      const current = await redisClient.incr(redisKey);
      
      if (current === 1) {
        // Primera request, establecer TTL
        await redisClient.expire(redisKey, 60); // 60 segundos
      }

      const ttl = await redisClient.ttl(redisKey);
      const resetTime = new Date(Date.now() + (ttl * 1000));

      return {
        totalHits: current,
        resetTime
      };
    } catch (error) {
      console.error('Error en RedisStore.increment:', error);
      return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
    }
  }

  async decrement(key) {
    const redisKey = this.prefix + key;
    
    if (!isConnected()) return;

    try {
      await redisClient.decr(redisKey);
    } catch (error) {
      console.error('Error en RedisStore.decrement:', error);
    }
  }

  async resetKey(key) {
    const redisKey = this.prefix + key;
    
    if (!isConnected()) return;

    try {
      await redisClient.del(redisKey);
    } catch (error) {
      console.error('Error en RedisStore.resetKey:', error);
    }
  }
}

/**
 * Rate limiter general para la API
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: {
    error: 'TooManyRequests',
    message: 'Demasiadas solicitudes, intenta de nuevo más tarde'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:general:' })
});

/**
 * Rate limiter estricto para endpoints críticos
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 requests por ventana
  message: {
    error: 'TooManyRequests',
    message: 'Límite de solicitudes excedido'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:strict:' })
});

/**
 * Rate limiter para operaciones de compra/reserva
 */
const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 intentos por minuto
  message: {
    error: 'TooManyRequests',
    message: 'Demasiados intentos de compra, espera un momento'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar requests exitosos
  store: new RedisStore({ prefix: 'rl:purchase:' })
});

/**
 * Rate limiter para webhooks
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 webhooks por minuto
  message: {
    error: 'TooManyRequests',
    message: 'Demasiados webhooks'
  },
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar IP + webhook type como key
    return `${req.ip}:${req.body?.type || 'unknown'}`;
  },
  store: new RedisStore({ prefix: 'rl:webhook:' })
});

/**
 * Rate limiter para autenticación/login
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos de login
  message: {
    error: 'TooManyRequests',
    message: 'Demasiados intentos de autenticación, intenta más tarde'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: new RedisStore({ prefix: 'rl:auth:' })
});

/**
 * Rate limiter adaptativo basado en comportamiento
 */
function adaptiveRateLimiter(options = {}) {
  const baseMax = options.max || 50;
  const windowMs = options.windowMs || 60 * 1000;

  return rateLimit({
    windowMs,
    max: async (req) => {
      // Usuarios autenticados tienen más límite
      if (req.user) {
        if (req.user.role === 'admin') return baseMax * 10;
        if (req.user.role === 'producer') return baseMax * 5;
        return baseMax * 2;
      }
      return baseMax;
    },
    message: {
      error: 'TooManyRequests',
      message: 'Límite de solicitudes excedido'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({ prefix: 'rl:adaptive:' })
  });
}

/**
 * Middleware de protección anti-bot simple
 * Detecta patrones sospechosos de automatización
 */
async function antiBotProtection(req, res, next) {
  const userAgent = req.get('user-agent') || '';
  const ip = req.ip;

  // Lista de user agents sospechosos
  const suspiciousAgents = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests'
  ];

  const isSuspicious = suspiciousAgents.some(agent => 
    userAgent.toLowerCase().includes(agent)
  );

  if (isSuspicious && !req.user) {
    // Bloquear bots no autenticados
    console.warn('Bot detectado:', { ip, userAgent });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Acceso denegado'
    });
  }

  // Verificar frecuencia de requests por IP
  if (isConnected()) {
    try {
      const key = `antibot:${ip}`;
      const count = await redisClient.incr(key);
      
      if (count === 1) {
        await redisClient.expire(key, 10); // 10 segundos
      }

      // Más de 20 requests en 10 segundos es sospechoso
      if (count > 20) {
        console.warn('Actividad sospechosa detectada:', { ip, count });
        return res.status(429).json({
          error: 'TooManyRequests',
          message: 'Actividad sospechosa detectada'
        });
      }
    } catch (error) {
      console.error('Error en anti-bot:', error);
    }
  }

  next();
}

module.exports = {
  generalLimiter,
  strictLimiter,
  purchaseLimiter,
  webhookLimiter,
  authLimiter,
  adaptiveRateLimiter,
  antiBotProtection,
  RedisStore
};
