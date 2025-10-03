const { pool } = require('../src/db');
// Try to import deleteImage; fallback to simple version or no-op
let deleteImage;
try {
  ({ deleteImage } = require('../middlewares/uploadImage'));
} catch (e) {
  try {
    ({ deleteImage } = require('../middlewares/uploadImageSimple'));
  } catch (e2) {
    console.error('[EventsController] Warning: No image deletion available; deleteImage will be a no-op.', e2 && e2.message ? e2.message : e2);
    deleteImage = async () => {};
  }
}

// Utilidad: obtener set de columnas existentes para una tabla
async function getColumnsSet(conn, tableName) {
  try {
    const [rows] = await conn.query(`SHOW COLUMNS FROM ${tableName}`);
    return new Set(rows.map(r => r.Field));
  } catch (_) {
    return new Set();
  }
}

// Listar eventos con paginación y filtros
exports.getEvents = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = 'active',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Debug logging for incoming GET /api/events
    console.log('[Events] GET /api/events requested', {
      query: { page, limit, search, status, sortBy, sortOrder },
      ip: req.ip,
      origin: req.headers.origin || null,
      time: new Date().toISOString()
    });

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    // Filtro de búsqueda por nombre
    if (search) {
      whereClause += ' AND e.name LIKE ?';
      params.push(`%${search}%`);
    }
    
    // Filtro por estado (activo = tiene shows futuros)
    if (status === 'active') {
      whereClause += ' AND EXISTS (SELECT 1 FROM shows s WHERE s.event_id = e.id AND s.starts_at > NOW())';
    }
    
    // Validar campos de ordenamiento
    const validSortFields = ['name', 'created_at', 'id'];
    const validSortOrders = ['ASC', 'DESC'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    // Detectar columnas disponibles para compatibilidad con esquemas antiguos
    const eventCols = await getColumnsSet(conn, 'events');
    const venueCols = await getColumnsSet(conn, 'venues');

    const selectParts = [
      'e.id',
      'e.name',
      'e.organizer_id',
      'e.venue',
      eventCols.has('image_url') ? 'e.image_url' : 'NULL as image_url',
      eventCols.has('image_filename') ? 'e.image_filename' : 'NULL as image_filename',
      eventCols.has('description') ? 'e.description' : 'NULL as description',
      'e.venue_id',
      'v.name as venue_name',
      venueCols.has('city') ? 'v.city as venue_city' : 'NULL as venue_city',
      venueCols.has('max_capacity') ? 'v.max_capacity as venue_capacity' : 'NULL as venue_capacity',
      'e.created_at',
      'COUNT(s.id) as show_count',
      'MIN(s.starts_at) as next_show_date',
      'MAX(s.starts_at) as last_show_date'
    ];

    const groupByParts = [
      'e.id', 'e.name', 'e.organizer_id', 'e.venue', 'e.venue_id', 'v.name', 'e.created_at'
    ];
    if (eventCols.has('description')) groupByParts.push('e.description');
    if (eventCols.has('image_url')) groupByParts.push('e.image_url');
    if (eventCols.has('image_filename')) groupByParts.push('e.image_filename');
    if (venueCols.has('city')) groupByParts.push('v.city');
    if (venueCols.has('max_capacity')) groupByParts.push('v.max_capacity');

    // Query principal con información de shows y venues, tolerante a columnas faltantes
    const query = `
      SELECT 
        ${selectParts.join(',\n        ')}
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN shows s ON e.id = s.event_id
      ${whereClause}
      GROUP BY ${groupByParts.join(', ')}
      ORDER BY e.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    params.push(parseInt(limit), offset);
    const [events] = await conn.query(query, params);
    
    // Query para contar total
    const countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM events e
      LEFT JOIN shows s ON e.id = s.event_id
      ${whereClause}
    `;
    
    const [countResult] = await conn.query(countQuery, params.slice(0, -2));
    const total = countResult[0].total;
    
    console.log('[Events] GET /api/events result', {
      count: events.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[Events] GET /api/events error:', err && err.stack ? err.stack : err);
    throw err;
  } finally {
    conn.release();
  }
};

// Búsqueda rápida de eventos (para autocomplete/typeahead)
exports.searchEvents = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { q = '', limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ events: [] });
    }
    
    // Detectar columnas disponibles
    const eventCols = await getColumnsSet(conn, 'events');
    const venueCols = await getColumnsSet(conn, 'venues');

    const selectParts = [
      'e.id',
      'e.name',
      eventCols.has('image_url') ? 'e.image_url' : 'NULL as image_url',
      'v.name as venue_name',
      venueCols.has('city') ? 'v.city as venue_city' : 'NULL as venue_city',
      'COUNT(s.id) as show_count',
      'MIN(s.starts_at) as next_show_date'
    ];
    const groupByParts = ['e.id', 'e.name', 'v.name'];
    if (eventCols.has('image_url')) groupByParts.push('e.image_url');
    if (venueCols.has('city')) groupByParts.push('v.city');

    const query = `
      SELECT 
        ${selectParts.join(',\n        ')}
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN shows s ON e.id = s.event_id AND s.starts_at > NOW()
      WHERE e.name LIKE ?
      GROUP BY ${groupByParts.join(', ')}
      HAVING show_count > 0
      ORDER BY e.name ASC
      LIMIT ?
    `;

    const [events] = await conn.query(query, [`%${q}%`, parseInt(limit)]);
    
    res.json({ events });
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};

exports.createEventWithShow = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, venue, venue_id, description, startsAt } = req.body || {};
    // Debug logging for incoming POST /api/events
    console.log('[Events] POST /api/events creating event', {
      body: { name, venue, venue_id, description, startsAt },
      hasFile: !!req.file,
      processedImage: req.processedImage ? {
        url: req.processedImage.url,
        filename: req.processedImage.filename,
      } : null,
      ip: req.ip,
      origin: req.headers.origin || null,
      time: new Date().toISOString()
    });
    await conn.beginTransaction();

    // Detectar columnas disponibles en la tabla events
    const eventCols = await getColumnsSet(conn, 'events');

    // Procesar imagen si fue subida
    let imageUrl = null;
    let imageFilename = null;
    if (req.processedImage) {
      imageUrl = req.processedImage.url;
      imageFilename = req.processedImage.filename;
    }

    // Construir INSERT dinámico basado en columnas disponibles
    const insertFields = ['name', 'organizer_id'];
    const insertValues = [name, null];
    
    if (eventCols.has('venue')) {
      insertFields.push('venue');
      insertValues.push(venue || null);
    }
    
    if (eventCols.has('venue_id')) {
      insertFields.push('venue_id');
      insertValues.push(venue_id || null);
    }
    
    if (eventCols.has('description')) {
      insertFields.push('description');
      insertValues.push(description || null);
    }
    
    if (eventCols.has('image_url') && imageUrl) {
      insertFields.push('image_url');
      insertValues.push(imageUrl);
    }
    
    if (eventCols.has('image_filename') && imageFilename) {
      insertFields.push('image_filename');
      insertValues.push(imageFilename);
    }

    const insertQuery = `INSERT INTO events (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;
    
    const [e] = await conn.query(insertQuery, insertValues);
    const eventId = e.insertId;

    const [s] = await conn.query(
      `INSERT INTO shows (event_id, starts_at, status) VALUES (?, ?, 'PUBLISHED')`,
      [eventId, new Date(startsAt)]
    );
    const showId = s.insertId;

    await conn.commit();
    console.log('[Events] POST /api/events created successfully', { eventId, showId, name });
    res.status(201).json({ 
      eventId, 
      showId, 
      name, 
      venue: venue || null, 
      venue_id: venue_id || null,
      description: description || null,
      image_url: imageUrl,
      startsAt 
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    // Si hubo error y se subió imagen, eliminarla
    if (req.processedImage) {
      await deleteImage(req.processedImage.filename);
    }
    console.error('[Events] POST /api/events error:', err && err.stack ? err.stack : err);
    throw err;
  } finally {
    conn.release();
  }
};

// Obtener evento por ID con información completa
exports.getEventById = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    
    const [events] = await conn.query(`
      SELECT 
        e.*,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city,
        v.max_capacity as venue_capacity
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      WHERE e.id = ?
    `, [id]);
    
    if (events.length === 0) {
      const err = new Error('Evento no encontrado');
      err.status = 404;
      throw err;
    }
    
    // Obtener shows del evento
    const [shows] = await conn.query(`
      SELECT id, starts_at, status, created_at
      FROM shows 
      WHERE event_id = ?
      ORDER BY starts_at ASC
    `, [id]);
    
    const event = events[0];
    event.shows = shows;
    
    res.json(event);
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};

// Actualizar evento
exports.updateEvent = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { name, venue, venue_id, description } = req.body || {};
    
    // Detectar columnas disponibles
    const eventCols = await getColumnsSet(conn, 'events');
    
    // Verificar que el evento existe y obtener imagen anterior si la columna existe
    let selectFields = ['id'];
    if (eventCols.has('image_filename')) {
      selectFields.push('image_filename');
    }
    
    const [existing] = await conn.query(`SELECT ${selectFields.join(', ')} FROM events WHERE id = ?`, [id]);
    if (existing.length === 0) {
      const err = new Error('Evento no encontrado');
      err.status = 404;
      throw err;
    }
    
    await conn.beginTransaction();
    
    // Procesar nueva imagen si fue subida
    let imageUrl = null;
    let imageFilename = null;
    let oldImageFilename = eventCols.has('image_filename') ? existing[0].image_filename : null;
    
    if (req.processedImage) {
      imageUrl = req.processedImage.url;
      imageFilename = req.processedImage.filename;
    }
    
    // Construir query dinámico basado en columnas disponibles
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (venue !== undefined && eventCols.has('venue')) { updates.push('venue = ?'); params.push(venue); }
    if (venue_id !== undefined && eventCols.has('venue_id')) { updates.push('venue_id = ?'); params.push(venue_id); }
    if (description !== undefined && eventCols.has('description')) { updates.push('description = ?'); params.push(description); }
    if (imageUrl !== null && eventCols.has('image_url')) { 
      updates.push('image_url = ?'); 
      params.push(imageUrl); 
    }
    if (imageFilename !== null && eventCols.has('image_filename')) { 
      updates.push('image_filename = ?'); 
      params.push(imageFilename); 
    }
    
    if (updates.length > 0) {
      params.push(id);
      await conn.query(
        `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    
    await conn.commit();
    
    // Eliminar imagen anterior si se subió una nueva
    if (imageUrl && oldImageFilename) {
      await deleteImage(oldImageFilename);
    }
    
    // Devolver evento actualizado
    const [updated] = await conn.query(`
      SELECT 
        e.*,
        v.name as venue_name,
        v.city as venue_city
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      WHERE e.id = ?
    `, [id]);
    
    res.json(updated[0]);
  } catch (err) {
    try { await conn.rollback(); } catch {}
    // Si hubo error y se subió imagen, eliminarla
    if (req.processedImage) {
      await deleteImage(req.processedImage.filename);
    }
    throw err;
  } finally {
    conn.release();
  }
};

// Eliminar evento
exports.deleteEvent = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    
    // Detectar columnas disponibles
    const eventCols = await getColumnsSet(conn, 'events');
    
    // Obtener información del evento antes de eliminarlo
    let selectFields = ['id'];
    if (eventCols.has('image_filename')) {
      selectFields.push('image_filename');
    }
    
    const [events] = await conn.query(`SELECT ${selectFields.join(', ')} FROM events WHERE id = ?`, [id]);
    if (events.length === 0) {
      const err = new Error('Evento no encontrado');
      err.status = 404;
      throw err;
    }
    
    await conn.beginTransaction();
    
    // Eliminar shows asociados
    await conn.query(`DELETE FROM shows WHERE event_id = ?`, [id]);
    
    // Eliminar evento
    await conn.query(`DELETE FROM events WHERE id = ?`, [id]);
    
    await conn.commit();
    
    // Eliminar imagen si existe y la columna está disponible
    if (eventCols.has('image_filename') && events[0].image_filename) {
      await deleteImage(events[0].image_filename);
    }
    
    res.json({ message: 'Evento eliminado correctamente' });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
};
