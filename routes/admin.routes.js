
const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { authenticate, authorize, ROLES } = require('../middlewares/auth');
const { strictLimiter } = require('../middlewares/rateLimiting');
const { 
  getFixedFee, 
  setFixedFee, 
  getMercadoPagoSettings, 
  setMercadoPagoSettings,
  testMercadoPagoConnection 
} = require('../controllers/admin.controller');

const router = Router();

// Aplicar autenticación y autorización a todas las rutas de admin
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));
router.use(strictLimiter);

// Configuración de tarifas
router.get('/settings/fixed-fee', asyncHandler(getFixedFee));
router.put('/settings/fixed-fee', requireFields(['fixedFeeCents']), asyncHandler(setFixedFee));

// Configuración de MercadoPago
router.get('/settings/mercadopago', asyncHandler(getMercadoPagoSettings));
router.put('/settings/mercadopago', requireFields(['accessToken', 'publicKey']), asyncHandler(setMercadoPagoSettings));
router.post('/settings/mercadopago/test', asyncHandler(testMercadoPagoConnection));

module.exports = router;
