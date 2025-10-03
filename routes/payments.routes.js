const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { authenticate, authorize, requireOwnership, ROLES } = require('../middlewares/auth');
const { verifyMercadoPagoWebhook, webhookIdempotency } = require('../middlewares/webhookVerification');
const { paymentIdempotency } = require('../middlewares/idempotency');
const { purchaseLimiter, webhookLimiter, strictLimiter } = require('../middlewares/rateLimiting');
const paymentsController = require('../controllers/payments.controller');

const router = Router();

// Crear preferencia de pago para reservas (nuevo sistema)
router.post('/create-preference-reservation', 
  authenticate,
  purchaseLimiter,
  paymentIdempotency,
  requireFields(['reservationIds', 'payer', 'backUrls']),
  asyncHandler(paymentsController.createPaymentPreferenceForReservation)
);

// Crear preferencia de pago (sistema anterior)
router.post('/create-preference', 
  authenticate,
  purchaseLimiter,
  paymentIdempotency,
  requireFields(['orderId', 'payer', 'backUrls']),
  asyncHandler(paymentsController.createPaymentPreference)
);

// Webhook de MercadoPago - SIN autenticación pero CON verificación de firma
router.post('/webhook', 
  webhookLimiter,
  verifyMercadoPagoWebhook,
  webhookIdempotency,
  asyncHandler(paymentsController.handleWebhook)
);

// Obtener estado de pago - requiere ownership del pedido
router.get('/status/:orderId', 
  authenticate,
  requireOwnership(async (req) => {
    // Función para obtener el owner del pedido
    const { db } = require('../src/db');
    const [rows] = await db.execute(
      'SELECT user_id FROM orders WHERE id = ?',
      [req.params.orderId]
    );
    return rows[0]?.user_id;
  }),
  asyncHandler(paymentsController.getPaymentStatus)
);

// Reembolsar pago - solo admin
router.post('/refund/:orderId', 
  authenticate,
  authorize(ROLES.ADMIN),
  strictLimiter,
  requireFields(['reason']),
  asyncHandler(paymentsController.refundPayment)
);

module.exports = router;
