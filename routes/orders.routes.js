const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { authenticate, requireOwnership } = require('../middlewares/auth');
const { reservationLock, requireTransaction } = require('../middlewares/concurrency');
const { reservationIdempotency } = require('../middlewares/idempotency');
const { purchaseLimiter } = require('../middlewares/rateLimiting');
const { validate, schemas } = require('../middlewares/validation');
const queueAccessMiddleware = require('../middlewares/queueAccess');
const { createOrder } = require('../controllers/orders.controller');

const router = Router();

router.post('/',
  authenticate,
  purchaseLimiter,
  validate(schemas.createReservation),
  reservationIdempotency,
  reservationLock,
  requireTransaction,
  requireFields(['userId', 'showId', 'seats']),
  asyncHandler(queueAccessMiddleware),
  asyncHandler(createOrder)
);

module.exports = router;

