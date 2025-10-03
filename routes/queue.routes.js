const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize, optionalAuth, ROLES } = require('../middlewares/auth');
const { queueJoinIdempotency } = require('../middlewares/idempotency');
const { adaptiveRateLimiter, antiBotProtection } = require('../middlewares/rateLimiting');
const {
  joinQueue,
  getQueuePosition,
  processNext,
  verifyAccess,
  leaveQueue,
  getQueueStatus
} = require('../controllers/queue.controller');

const router = Router();

// Protección anti-bot para todas las rutas de cola
router.use(antiBotProtection);

// Unirse a la cola de un show - requiere autenticación e idempotencia
router.post('/:showId/join', 
  authenticate,
  adaptiveRateLimiter({ max: 10, windowMs: 60000 }), // 10 intentos por minuto
  queueJoinIdempotency,
  asyncHandler(joinQueue)
);

// Obtener posición en la cola - requiere autenticación
router.get('/:showId/position', 
  authenticate,
  adaptiveRateLimiter({ max: 30, windowMs: 60000 }), // 30 consultas por minuto
  asyncHandler(getQueuePosition)
);

// Procesar siguiente en la cola - solo admin o producer del evento
router.post('/:showId/process-next', 
  authenticate,
  authorize(ROLES.ADMIN, ROLES.PRODUCER),
  asyncHandler(processNext)
);

// Verificar token de acceso - autenticación opcional
router.post('/:showId/verify-access', 
  optionalAuth,
  adaptiveRateLimiter({ max: 20, windowMs: 60000 }),
  asyncHandler(verifyAccess)
);

// Salir de la cola - requiere autenticación
router.delete('/:showId/leave', 
  authenticate,
  asyncHandler(leaveQueue)
);

// Obtener estado de la cola - público pero con rate limiting
router.get('/:showId/status', 
  optionalAuth,
  adaptiveRateLimiter({ max: 50, windowMs: 60000 }),
  asyncHandler(getQueueStatus)
);

module.exports = router;
