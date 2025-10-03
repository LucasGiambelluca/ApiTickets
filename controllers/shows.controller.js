const { pool } = require('../src/db');

// Crear un nuevo show (ahora con venue opcional a nivel show)
exports.createShow = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { eventId, startsAt, status = 'PUBLISHED', venueId = null } = req.body;

    // Validaciones
    if (!eventId || !startsAt) {
      const err = new Error('eventId y startsAt son requeridos');
      err.status = 400;
      err.code = 'BadRequest';
      throw err;
    }

    // Verificar que el evento existe (y obtener su venue por si necesitamos heredar)
    const [[event]] = await conn.query(
      'SELECT id, name, venue_id FROM events WHERE id = ?',
      [eventId]
    );

    if (!event) {
      const err = new Error('Evento no encontrado');
      err.status = 404;
      err.code = 'EventNotFound';
      throw err;
    }

    // Validar fecha
    const showDate = new Date(startsAt);
    if (isNaN(showDate.getTime())) {
      const err = new Error('Fecha de inicio inválida');
      err.status = 400;
      err.code = 'InvalidDate';
      throw err;
    }

    // Validar venue (si se especifica) o heredar del evento
    let effectiveVenueId = venueId || event.venue_id || null;
    if (venueId) {
      const [[venue]] = await conn.query('SELECT id FROM venues WHERE id = ?', [venueId]);
      if (!venue) {
        const err = new Error('Venue no encontrado');
        err.status = 404;
        err.code = 'VenueNotFound';
        throw err;
      }
    }

    // Verificar que no haya conflicto de horarios (opcional)
    const [[existingShow]] = await conn.query(
      'SELECT id FROM shows WHERE event_id = ? AND starts_at = ?',
      [eventId, startsAt]
    );

    if (existingShow) {
      const err = new Error('Ya existe un show para este evento en la misma fecha y hora');
      err.status = 409;
      err.code = 'ShowConflict';
      throw err;
    }

    await conn.beginTransaction();

    // Crear el show (incluye venue_id si existe la columna)
    // Intentamos incluir venue_id; si la columna no existe aún (antes del upgrade), caemos al insert sin venue
    let showId;
    try {
      const [result] = await conn.query(
        'INSERT INTO shows (event_id, starts_at, status, venue_id) VALUES (?, ?, ?, ?)',
        [eventId, startsAt, status, effectiveVenueId]
      );
      showId = result.insertId;
    } catch (e) {
      // Fallback para esquemas sin venue_id en shows
      const [result] = await conn.query(
        'INSERT INTO shows (event_id, starts_at, status) VALUES (?, ?, ?)',
        [eventId, startsAt, status]
      );
      showId = result.insertId;
    }

    await conn.commit();

    // Obtener el show creado con información de evento y venue (prefiere show.venue_id si existe)
    const [[newShow]] = await conn.query(`
      SELECT 
        s.id, s.event_id, s.starts_at, s.status, s.created_at,
        e.name AS eventName,
        COALESCE(s.venue_id, e.venue_id) AS venue_id,
        COALESCE(vs.name, ve.name) AS venue_name,
        COALESCE(vs.capacity_max, ve.capacity_max) AS venue_capacity
      FROM shows s
      JOIN events e ON s.event_id = e.id
      LEFT JOIN venues vs ON vs.id = s.venue_id
      LEFT JOIN venues ve ON ve.id = e.venue_id
      WHERE s.id = ?
    `, [showId]);

    res.status(201).json({
      message: 'Show creado exitosamente',
      show: newShow
    });

  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    throw error;
  } finally {
    conn.release();
  }
};

// Listar todos los shows
exports.listShows = async (req, res) => {
  const [rows] = await pool.query(`
    SELECT 
      s.id, s.event_id, s.starts_at, s.status,
      e.name AS eventName,
      COALESCE(s.venue_id, e.venue_id) AS venue_id,
      COALESCE(vs.name, ve.name) AS venueName
    FROM shows s
    JOIN events e ON s.event_id = e.id
    LEFT JOIN venues vs ON vs.id = s.venue_id
    LEFT JOIN venues ve ON ve.id = e.venue_id
    ORDER BY s.starts_at ASC
  `);
  res.json(rows);
};

// Obtener un show específico
exports.getShow = async (req, res) => {
  const showId = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT 
      s.id, s.event_id, s.starts_at, s.status,
      e.name AS eventName,
      COALESCE(s.venue_id, e.venue_id) AS venue_id,
      COALESCE(vs.name, ve.name) AS venueName
    FROM shows s
    JOIN events e ON s.event_id = e.id
    LEFT JOIN venues vs ON vs.id = s.venue_id
    LEFT JOIN venues ve ON ve.id = e.venue_id
    WHERE s.id = ?
  `, [showId]);

  if (rows.length === 0) {
    return res.status(404).json({ error: "NotFound" });
  }

  res.json(rows[0]);
};

// (ya existente) Listar asientos de un show
exports.listSeats = async (req, res) => {
  const showId = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT s.id, s.sector, s.row_label AS rowLabel, s.seat_number AS seatNumber,
           s.status, s.reserved_by AS reservedBy, s.reserved_until AS reservedUntil,
           pt.price_cents AS priceCents
    FROM seats s
    LEFT JOIN price_tiers pt ON s.price_tier_id = pt.id
    WHERE s.show_id = ?
    ORDER BY s.sector, s.row_label, CAST(s.seat_number AS UNSIGNED)
  `, [showId]);

  res.json({ showId, seats: rows });
};

// Búsqueda rápida de shows (por nombre de evento o ID de show)
exports.searchShows = async (req, res) => {
  const { q = '', limit = 10 } = req.query;

  if (!q || String(q).trim().length < 2) {
    return res.json({ shows: [] });
  }

  const like = `%${q}%`;

  const [rows] = await pool.query(`
    SELECT 
      s.id,
      s.event_id,
      s.starts_at,
      s.status,
      e.name AS eventName
    FROM shows s
    JOIN events e ON s.event_id = e.id
    WHERE e.name LIKE ? OR s.id = CAST(? AS UNSIGNED)
    ORDER BY s.starts_at ASC
    LIMIT ?
  `, [like, q, parseInt(limit, 10)]);

  res.json({ shows: rows });
};
