const { pool } = require('../src/db');
const Joi = require('joi');

// Esquemas de validación
const createTicketTypeSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  price_cents: Joi.number().integer().min(0).required(),
  quantity_total: Joi.number().integer().min(1).required(),
  sale_start: Joi.date().iso().optional(),
  sale_end: Joi.date().iso().optional(),
  is_active: Joi.boolean().optional()
});

const createReservationSchema = Joi.object({
  eventId: Joi.number().integer().positive().required(),
  tickets: Joi.array().items(
    Joi.object({
      typeId: Joi.number().integer().positive().required(),
      quantity: Joi.number().integer().min(1).max(10).required()
    })
  ).min(1).required(),
  customerInfo: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().max(50).optional()
  }).required()
});

// Obtener tipos de tickets de un evento
exports.getTicketTypes = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const eventId = Number(req.params.eventId);
    
    // Verificar que el evento existe
    const [[event]] = await conn.query(
      'SELECT id, name FROM events WHERE id = ?',
      [eventId]
    );
    
    if (!event) {
      return res.status(404).json({
        error: 'EventNotFound',
        message: 'Evento no encontrado'
      });
    }
    
    // Obtener tipos de tickets con disponibilidad
    const [ticketTypes] = await conn.query(`
      SELECT 
        id,
        name,
        description,
        price_cents,
        quantity_total,
        quantity_sold,
        quantity_reserved,
        (quantity_total - quantity_sold - quantity_reserved) as available,
        sale_start,
        sale_end,
        is_active,
        created_at
      FROM ticket_types 
      WHERE event_id = ? AND is_active = TRUE
      ORDER BY price_cents ASC
    `, [eventId]);
    
    res.json({
      event: {
        id: event.id,
        name: event.name
      },
      ticketTypes: ticketTypes.map(tt => ({
        ...tt,
        price: tt.price_cents / 100, // Convertir a pesos para el frontend
        isOnSale: isTicketOnSale(tt),
        availability: getAvailabilityStatus(tt)
      }))
    });
    
  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

// Crear tipos de tickets para un evento
exports.createTicketTypes = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const eventId = Number(req.params.eventId);
    const { types } = req.body;
    
    if (!Array.isArray(types) || types.length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Se requiere un array de tipos de tickets'
      });
    }
    
    // Validar cada tipo de ticket
    for (const type of types) {
      const { error } = createTicketTypeSchema.validate(type);
      if (error) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Error en tipo "${type.name}": ${error.details[0].message}`
        });
      }
    }
    
    // Verificar que el evento existe
    const [[event]] = await conn.query(
      'SELECT id FROM events WHERE id = ?',
      [eventId]
    );
    
    if (!event) {
      return res.status(404).json({
        error: 'EventNotFound',
        message: 'Evento no encontrado'
      });
    }
    
    await conn.beginTransaction();
    
    const createdTypes = [];
    let totalCapacity = 0;
    
    for (const type of types) {
      const [result] = await conn.query(`
        INSERT INTO ticket_types (
          event_id, name, description, price_cents, quantity_total,
          sale_start, sale_end, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        eventId,
        type.name,
        type.description || null,
        type.price_cents,
        type.quantity_total,
        type.sale_start || null,
        type.sale_end || null,
        type.is_active !== false
      ]);
      
      totalCapacity += type.quantity_total;
      
      createdTypes.push({
        id: result.insertId,
        ...type,
        available: type.quantity_total
      });
    }
    
    // Actualizar capacidad total del evento
    await conn.query(
      'UPDATE events SET total_capacity = total_capacity + ? WHERE id = ?',
      [totalCapacity, eventId]
    );
    
    await conn.commit();
    
    res.status(201).json({
      message: 'Tipos de tickets creados exitosamente',
      eventId,
      ticketTypes: createdTypes,
      totalCapacityAdded: totalCapacity
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

// Crear reserva de tickets
exports.createReservation = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { error, value } = createReservationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'ValidationError',
        message: error.details[0].message
      });
    }
    
    const { eventId, tickets, customerInfo } = value;
    
    await conn.beginTransaction();
    
    // Verificar disponibilidad de todos los tipos de tickets
    const ticketTypeIds = tickets.map(t => t.typeId);
    const [availableTypes] = await conn.query(`
      SELECT 
        id,
        name,
        price_cents,
        quantity_total,
        quantity_sold,
        quantity_reserved,
        (quantity_total - quantity_sold - quantity_reserved) as available,
        sale_start,
        sale_end,
        is_active
      FROM ticket_types 
      WHERE id IN (?) AND event_id = ? AND is_active = TRUE
      FOR UPDATE
    `, [ticketTypeIds, eventId]);
    
    if (availableTypes.length !== ticketTypeIds.length) {
      return res.status(404).json({
        error: 'TicketTypeNotFound',
        message: 'Uno o más tipos de tickets no encontrados'
      });
    }
    
    // Verificar disponibilidad y períodos de venta
    const reservations = [];
    let totalAmount = 0;
    
    for (const ticket of tickets) {
      const ticketType = availableTypes.find(t => t.id === ticket.typeId);
      
      if (!isTicketOnSale(ticketType)) {
        return res.status(400).json({
          error: 'TicketNotOnSale',
          message: `El ticket "${ticketType.name}" no está en venta actualmente`
        });
      }
      
      if (ticketType.available < ticket.quantity) {
        return res.status(409).json({
          error: 'InsufficientStock',
          message: `No hay suficientes tickets "${ticketType.name}" disponibles. Disponibles: ${ticketType.available}`
        });
      }
      
      totalAmount += ticketType.price_cents * ticket.quantity;
      
      // Crear reserva (expira en 15 minutos)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      const [reservationResult] = await conn.query(`
        INSERT INTO ticket_reservations (
          ticket_type_id, quantity, customer_name, customer_email, 
          customer_phone, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        ticket.typeId,
        ticket.quantity,
        customerInfo.name,
        customerInfo.email,
        customerInfo.phone || null,
        expiresAt
      ]);
      
      reservations.push({
        id: reservationResult.insertId,
        ticketTypeId: ticket.typeId,
        ticketTypeName: ticketType.name,
        quantity: ticket.quantity,
        unitPrice: ticketType.price_cents,
        subtotal: ticketType.price_cents * ticket.quantity,
        expiresAt
      });
    }
    
    await conn.commit();
    
    res.status(201).json({
      reservationIds: reservations.map(r => r.id),
      reservations,
      customer: customerInfo,
      totalAmount,
      totalAmountFormatted: (totalAmount / 100).toFixed(2),
      expiresAt: reservations[0].expiresAt,
      message: 'Reserva creada exitosamente. Tienes 15 minutos para completar el pago.'
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

// Obtener reserva por ID
exports.getReservation = async (req, res) => {
  try {
    const reservationId = Number(req.params.reservationId);
    
    const [reservations] = await pool.query(`
      SELECT 
        tr.*,
        tt.name as ticket_type_name,
        tt.price_cents,
        e.name as event_name,
        e.id as event_id
      FROM ticket_reservations tr
      JOIN ticket_types tt ON tr.ticket_type_id = tt.id
      JOIN events e ON tt.event_id = e.id
      WHERE tr.id = ?
    `, [reservationId]);
    
    if (reservations.length === 0) {
      return res.status(404).json({
        error: 'ReservationNotFound',
        message: 'Reserva no encontrada'
      });
    }
    
    const reservation = reservations[0];
    
    res.json({
      id: reservation.id,
      eventId: reservation.event_id,
      eventName: reservation.event_name,
      ticketType: {
        id: reservation.ticket_type_id,
        name: reservation.ticket_type_name,
        price: reservation.price_cents
      },
      quantity: reservation.quantity,
      totalAmount: reservation.price_cents * reservation.quantity,
      customer: {
        name: reservation.customer_name,
        email: reservation.customer_email,
        phone: reservation.customer_phone
      },
      status: reservation.status,
      expiresAt: reservation.expires_at,
      createdAt: reservation.created_at,
      isExpired: new Date() > new Date(reservation.expires_at)
    });
    
  } catch (error) {
    throw error;
  }
};

// Funciones auxiliares
function isTicketOnSale(ticketType) {
  const now = new Date();
  const saleStart = ticketType.sale_start ? new Date(ticketType.sale_start) : null;
  const saleEnd = ticketType.sale_end ? new Date(ticketType.sale_end) : null;
  
  if (saleStart && now < saleStart) return false;
  if (saleEnd && now > saleEnd) return false;
  
  return ticketType.is_active && ticketType.available > 0;
}

function getAvailabilityStatus(ticketType) {
  if (!ticketType.is_active) return 'inactive';
  
  const now = new Date();
  const saleStart = ticketType.sale_start ? new Date(ticketType.sale_start) : null;
  const saleEnd = ticketType.sale_end ? new Date(ticketType.sale_end) : null;
  
  if (saleStart && now < saleStart) return 'not_started';
  if (saleEnd && now > saleEnd) return 'ended';
  if (ticketType.available <= 0) return 'sold_out';
  if (ticketType.available <= ticketType.quantity_total * 0.1) return 'low_stock';
  
  return 'available';
}

module.exports = exports;
