const { pool } = require('../src/db');

// Listar secciones de un show
exports.listSections = async (req, res) => {
  try {
    const showId = Number(req.params.showId);
    
    const [sections] = await pool.query(`
      SELECT ss.id, ss.show_id, ss.name, ss.kind, ss.capacity, ss.created_at,
             pt.price_cents, pt.currency,
             COUNT(s.id) as total_seats,
             SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_seats,
             SUM(CASE WHEN s.status = 'SOLD' THEN 1 ELSE 0 END) as sold_seats
      FROM show_sections ss
      LEFT JOIN price_tiers pt ON ss.price_tier_id = pt.id
      LEFT JOIN seats s ON s.show_id = ss.show_id AND s.sector = ss.name
      WHERE ss.show_id = ?
      GROUP BY ss.id, ss.show_id, ss.name, ss.kind, ss.capacity, ss.created_at, pt.price_cents, pt.currency
      ORDER BY ss.created_at ASC
    `, [showId]);

    res.json({
      showId,
      sections
    });
  } catch (error) {
    throw error;
  }
};

// Obtener una sección específica
exports.getSection = async (req, res) => {
  try {
    const { showId, sectionId } = req.params;
    
    const [[section]] = await pool.query(`
      SELECT ss.id, ss.show_id, ss.name, ss.kind, ss.capacity, ss.created_at,
             pt.price_cents, pt.currency,
             COUNT(s.id) as total_seats,
             SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_seats,
             SUM(CASE WHEN s.status = 'SOLD' THEN 1 ELSE 0 END) as sold_seats
      FROM show_sections ss
      LEFT JOIN price_tiers pt ON ss.price_tier_id = pt.id
      LEFT JOIN seats s ON s.show_id = ss.show_id AND s.sector = ss.name
      WHERE ss.show_id = ? AND ss.id = ?
      GROUP BY ss.id, ss.show_id, ss.name, ss.kind, ss.capacity, ss.created_at, pt.price_cents, pt.currency
    `, [showId, sectionId]);

    if (!section) {
      const err = new Error('Sección no encontrada');
      err.status = 404;
      err.code = 'SectionNotFound';
      throw err;
    }

    res.json(section);
  } catch (error) {
    throw error;
  }
};

// Crear sección/localidad
exports.createSection = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const showId = Number(req.params.showId);
    const { name, kind = 'GA', capacity, priceCents } = req.body || {};
    if (!['GA','SEATED'].includes(kind)) {
      const err = new Error('kind debe ser GA o SEATED'); err.status = 400; err.code = 'BadRequest'; throw err;
    }
    if (!Number.isInteger(capacity) || capacity <= 0) {
      const err = new Error('capacity debe ser entero > 0'); err.status = 400; err.code = 'BadRequest'; throw err;
    }

    await conn.beginTransaction();

    // Precio (creamos un price_tier para la sección)
    const [pt] = await conn.query(
      `INSERT INTO price_tiers (show_id, name, currency, price_cents) VALUES (?, ?, 'ARS', ?)`,
      [showId, name, priceCents]
    );
    const priceTierId = pt.insertId;

    // Sección
    const [sec] = await conn.query(
      `INSERT INTO show_sections (show_id, name, kind, capacity, price_tier_id) VALUES (?, ?, ?, ?, ?)`,
      [showId, name, kind, capacity, priceTierId]
    );

    // Validación de capacidad vs venue.max (opcional pero útil)
    const [[venueRow]] = await conn.query(
      `SELECT v.capacity_max AS vmax
         FROM shows sh
         JOIN events e ON e.id = sh.event_id
         JOIN venues v ON v.id = e.venue_id
        WHERE sh.id = ?`, [showId]
    );
    if (venueRow?.vmax) {
      const [[countRow]] = await conn.query(`SELECT COUNT(*) AS total FROM seats WHERE show_id = ?`, [showId]);
      const futureTotal = (countRow.total || 0) + capacity;
      if (futureTotal > venueRow.vmax) {
        const err = new Error(`Capacidad de show (${futureTotal}) excede el máximo del recinto (${venueRow.vmax})`);
        err.status = 409; err.code = 'VenueCapacityExceeded';
        throw err;
      }
    }

    // Generar asientos de la sección (1..capacity)
    // Para GA, row_label puede ser NULL; para SEATED, podés luego usar filas reales
    const values = [];
    for (let i = 1; i <= capacity; i++) {
      values.push([showId, name, null, String(i), 'AVAILABLE', priceTierId]);
    }
    await conn.query(
      `INSERT INTO seats (show_id, sector, row_label, seat_number, status, price_tier_id) VALUES ?`,
      [values]
    );

    await conn.commit();
    res.status(201).json({ sectionId: sec.insertId, showId, name, kind, capacity, priceTierId });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
};
