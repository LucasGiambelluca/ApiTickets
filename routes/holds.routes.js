const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { authenticate } = require('../middlewares/auth');
const { reservationLock, requireTransaction } = require('../middlewares/concurrency');
const { reservationIdempotency } = require('../middlewares/idempotency');
const { purchaseLimiter } = require('../middlewares/rateLimiting');
const { validate, schemas } = require('../middlewares/validation');
const { createHold } = require('../controllers/holds.controller');

const router = Router();

router.post('/:id/holds',
  authenticate,
  purchaseLimiter,
  validate(schemas.createReservation),
  reservationIdempotency,
  reservationLock,
  requireTransaction,
  requireFields(['userId', 'seats']), // seats: array de ids
  asyncHandler(createHold)
);

module.exports = router;

