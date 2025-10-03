const { Router } = require('express');
const router = Router();
const ticketTypesController = require('../controllers/ticketTypes.controller');

// Rutas para tipos de tickets por evento
router.get('/events/:eventId/ticket-types', ticketTypesController.getTicketTypes);
router.post('/events/:eventId/ticket-types', ticketTypesController.createTicketTypes);

// Rutas para reservas de tickets
router.post('/tickets/reserve', ticketTypesController.createReservation);
router.get('/tickets/reservations/:reservationId', ticketTypesController.getReservation);

module.exports = router;
