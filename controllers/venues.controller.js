const { pool } = require('../src/db');

// Listar venues con paginación y búsqueda
exports.getVenues = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      city = '',
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    // Filtro de búsqueda por nombre
    if (search) {
      whereClause += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    
    // Filtro por ciudad
    if (city) {
      whereClause += ' AND city = ?';
      params.push(city);
    }
    
    // Validar campos de ordenamiento
    const validSortFields = ['name', 'city', 'max_capacity', 'created_at'];
    const validSortOrders = ['ASC', 'DESC'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
    const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
    
    const query = `
      SELECT 
        id, name, address, city, state, country, postal_code,
        latitude, longitude, max_capacity, description, phone, email, website,
        created_at, updated_at
      FROM venues 
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    params.push(parseInt(limit), offset);
    const [venues] = await conn.query(query, params);
    
    // Query para contar total
    const countQuery = `SELECT COUNT(*) as total FROM venues ${whereClause}`;
    const [countResult] = await conn.query(countQuery, params.slice(0, -2));
    const total = countResult[0].total;
    
    res.json({
      venues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};

// Obtener venue por ID
exports.getVenueById = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    
    const [venues] = await conn.query(
      `SELECT * FROM venues WHERE id = ?`,
      [id]
    );
    
    if (venues.length === 0) {
      const err = new Error('Venue no encontrado');
      err.status = 404;
      throw err;
    }
    
    res.json(venues[0]);
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};

// Crear nuevo venue
exports.createVenue = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { 
      name, address, city, state, country = 'Argentina', postal_code,
      latitude, longitude, max_capacity, description, phone, email, website 
    } = req.body || {};
    
    // Validaciones básicas
    if (!name || !address || !city || !max_capacity) {
      const err = new Error('Faltan campos requeridos: name, address, city, max_capacity');
      err.status = 400;
      throw err;
    }
    
    if (max_capacity <= 0) {
      const err = new Error('La capacidad máxima debe ser mayor a 0');
      err.status = 400;
      throw err;
    }
    
    const [result] = await conn.query(
      `INSERT INTO venues (
        name, address, city, state, country, postal_code,
        latitude, longitude, max_capacity, description, phone, email, website
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, address, city, state || null, country, postal_code || null,
        latitude || null, longitude || null, max_capacity, description || null,
        phone || null, email || null, website || null
      ]
    );
    
    res.status(201).json({ 
      id: result.insertId, 
      name, address, city, state, country, postal_code,
      latitude, longitude, max_capacity, description, phone, email, website
    });
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};

// Actualizar venue
exports.updateVenue = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { 
      name, address, city, state, country, postal_code,
      latitude, longitude, max_capacity, description, phone, email, website 
    } = req.body || {};
    
    // Verificar que el venue existe
    const [existing] = await conn.query(`SELECT id FROM venues WHERE id = ?`, [id]);
    if (existing.length === 0) {
      const err = new Error('Venue no encontrado');
      err.status = 404;
      throw err;
    }
    
    // Construir query dinámico
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (city !== undefined) { updates.push('city = ?'); params.push(city); }
    if (state !== undefined) { updates.push('state = ?'); params.push(state); }
    if (country !== undefined) { updates.push('country = ?'); params.push(country); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); params.push(postal_code); }
    if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
    if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }
    if (max_capacity !== undefined) { 
      if (max_capacity <= 0) {
        const err = new Error('La capacidad máxima debe ser mayor a 0');
        err.status = 400;
        throw err;
      }
      updates.push('max_capacity = ?'); 
      params.push(max_capacity); 
    }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (website !== undefined) { updates.push('website = ?'); params.push(website); }
    
    if (updates.length === 0) {
      const err = new Error('No hay campos para actualizar');
      err.status = 400;
      throw err;
    }
    
    params.push(id);
    await conn.query(
      `UPDATE venues SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Devolver venue actualizado
    const [updated] = await conn.query(`SELECT * FROM venues WHERE id = ?`, [id]);
    res.json(updated[0]);
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};

// Eliminar venue
exports.deleteVenue = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    
    // Verificar que no hay eventos asociados
    const [events] = await conn.query(`SELECT COUNT(*) as count FROM events WHERE venue_id = ?`, [id]);
    if (events[0].count > 0) {
      const err = new Error('No se puede eliminar el venue porque tiene eventos asociados');
      err.status = 400;
      throw err;
    }
    
    const [result] = await conn.query(`DELETE FROM venues WHERE id = ?`, [id]);
    
    if (result.affectedRows === 0) {
      const err = new Error('Venue no encontrado');
      err.status = 404;
      throw err;
    }
    
    res.json({ message: 'Venue eliminado correctamente' });
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};

// Búsqueda rápida de venues (para autocomplete)
exports.searchVenues = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { q = '', limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ venues: [] });
    }
    
    const query = `
      SELECT id, name, city, max_capacity, address
      FROM venues
      WHERE name LIKE ? OR city LIKE ?
      ORDER BY name ASC
      LIMIT ?
    `;
    
    const [venues] = await conn.query(query, [`%${q}%`, `%${q}%`, parseInt(limit)]);
    
    res.json({ venues });
  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
};
