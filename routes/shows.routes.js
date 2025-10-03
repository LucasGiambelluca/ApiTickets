const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { createShow, listShows, getShow, listSeats, searchShows } = require('../controllers/shows.controller');

const router = Router();

// Crear nuevo show
router.post('/', 
  requireFields(['eventId', 'startsAt']),
  asyncHandler(createShow)
);

// Listar y buscar shows
router.get('/', asyncHandler(listShows));
router.get('/search', asyncHandler(searchShows));

// Show específico y sus asientos
router.get('/:id', asyncHandler(getShow));
router.get('/:id/seats', asyncHandler(listSeats));

module.exports = router;
