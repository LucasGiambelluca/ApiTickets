const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { 
  getVenues, 
  getVenueById, 
  createVenue, 
  updateVenue, 
  deleteVenue, 
  searchVenues 
} = require('../controllers/venues.controller');

const router = Router();

// GET /api/venues - Listar venues con paginación y filtros
router.get('/', asyncHandler(getVenues));

// GET /api/venues/search - Búsqueda rápida de venues
router.get('/search', asyncHandler(searchVenues));

// GET /api/venues/:id - Obtener venue por ID
router.get('/:id', asyncHandler(getVenueById));

// POST /api/venues - Crear venue
router.post('/', requireFields(['name', 'address', 'city', 'max_capacity']), asyncHandler(createVenue));

// PUT /api/venues/:id - Actualizar venue
router.put('/:id', asyncHandler(updateVenue));

// DELETE /api/venues/:id - Eliminar venue
router.delete('/:id', asyncHandler(deleteVenue));

module.exports = router;
