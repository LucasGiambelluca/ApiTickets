const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');

// Try to require uploadImage dependencies, fallback to simple version
let upload, processImage;
try {
  ({ upload, processImage } = require('../middlewares/uploadImage'));
  console.log('[EventsRoutes] Using advanced image processing with Sharp');
} catch (e) {
  console.log('[EventsRoutes] Sharp not available, using simple image processing');
  try {
    ({ upload, processImage } = require('../middlewares/uploadImageSimple'));
    console.log('[EventsRoutes] Simple image processing loaded successfully');
  } catch (e2) {
    console.error('[EventsRoutes] Warning: No image processing available.', e2 && e2.message ? e2.message : e2);
    upload = (_req, _res, next) => next();
    processImage = (_req, _res, next) => next();
  }
}
const { 
  createEventWithShow, 
  getEvents, 
  searchEvents, 
  getEventById, 
  updateEvent, 
  deleteEvent 
} = require('../controllers/events.controller');

const router = Router();

// GET /api/events - Listar eventos con paginación y búsqueda
router.get('/', asyncHandler(getEvents));

// GET /api/events/search - Búsqueda rápida de eventos
router.get('/search', asyncHandler(searchEvents));

// GET /api/events/:id - Obtener evento por ID
router.get('/:id', asyncHandler(getEventById));

// POST /api/events - Crear evento con show (con soporte de imagen)
router.post('/', 
  upload, 
  processImage, 
  requireFields(['name','startsAt']), 
  asyncHandler(createEventWithShow)
);

// PUT /api/events/:id - Actualizar evento (con soporte de imagen)
router.put('/:id', 
  upload, 
  processImage, 
  asyncHandler(updateEvent)
);

// DELETE /api/events/:id - Eliminar evento
router.delete('/:id', asyncHandler(deleteEvent));

module.exports = router;
