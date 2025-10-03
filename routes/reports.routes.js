const { Router } = require('express');
const router = Router();
const reportsController = require('../controllers/reports.controller');
const { authenticate, authorize, ROLES } = require('../middlewares/auth');
const { strictLimiter } = require('../middlewares/rateLimiting');

// Aplicar autenticación a todas las rutas de reportes
router.use(authenticate);
router.use(strictLimiter);

// Reporte completo de un evento específico (Admin y Producer del evento)
router.get('/event/:eventId', 
  authorize(ROLES.ADMIN, ROLES.PRODUCER),
  reportsController.getEventReport
);

// Reporte de todos los eventos (solo Admin)
router.get('/events', 
  authorize(ROLES.ADMIN),
  reportsController.getAllEventsReport
);

// Reporte de ventas por período (Admin y Producer)
router.get('/sales', 
  authorize(ROLES.ADMIN, ROLES.PRODUCER),
  reportsController.getSalesReport
);

module.exports = router;
