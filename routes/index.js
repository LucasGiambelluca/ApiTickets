// src/routes/index.js
const { Router } = require('express');
const router = Router();

// Health
router.get('/health', (_req, res) => res.json({ ok: true }));

// Montajes de rutas con mejor manejo de errores
function tryUse(mount, relPath, description = '') {
  try {
    const r = require(relPath);
    router.use(mount, r);
    console.log(`✅ Mounted ${mount} -> ${relPath} ${description}`);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      // Verificar si es el archivo principal o una dependencia
      if (e.message.includes(relPath)) {
        console.log(`⚠️  Skipping ${mount} (file ${relPath}.js not found)`);
      } else {
        console.error(`❌ Error mounting ${mount} from ${relPath}: Missing dependency - ${e.message}`);
      }
    } else {
      console.error(`❌ Error mounting ${mount} from ${relPath}:`, e.message);
      // No lanzar el error para evitar que el servidor se caiga
    }
  }
}

// Montaje de todas las rutas con descripciones
tryUse('/admin', './admin.routes', '(MercadoPago settings, fees)');
tryUse('/producers', './producers.routes', '(Producer management)');
tryUse('/venues', './venues.routes', '(Venue CRUD)');
tryUse('/events', './events.routes', '(Event CRUD)');
tryUse('/shows', './shows.routes', '(Show seats)');
tryUse('/shows', './holds.routes', '(Show holds)');
tryUse('/shows', './sections.routes', '(Show sections)');
tryUse('/orders', './orders.routes', '(Order creation)');
tryUse('/queue', './queue.routes', '(Virtual queue)');
tryUse('/payments', './payments.routes', '(MercadoPago payments)');
tryUse('/ticket-types', './ticketTypes.routes', '(Ticket types & reservations)');
tryUse('/reports', './reports.routes', '(Analytics & reports)');

module.exports = router;
