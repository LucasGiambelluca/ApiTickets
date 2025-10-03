const { pool } = require('../src/db');
const mercadoPagoService = require('../src/services/mercadoPagoService');
const Joi = require('joi');

// Esquemas de validación
const createPaymentSchema = Joi.object({
  orderId: Joi.number().integer().positive().required(),
  payer: Joi.object({
    name: Joi.string().required(),
    surname: Joi.string().optional(),
    email: Joi.string().email().required(),
    phone: Joi.object({
      area_code: Joi.string().optional(),
      number: Joi.string().optional()
    }).optional(),
    identification: Joi.object({
      type: Joi.string().optional(),
      number: Joi.string().optional()
    }).optional(),
    address: Joi.object({
      street_name: Joi.string().optional(),
      street_number: Joi.string().optional(),
      zip_code: Joi.string().optional()
    }).optional()
  }).required(),
  backUrls: Joi.object({
    success: Joi.string().uri().required(),
    failure: Joi.string().uri().required(),
    pending: Joi.string().uri().required()
  }).required()
});

// Crear preferencia de pago para reservas de tickets
exports.createPaymentPreferenceForReservation = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { reservationIds, payer, backUrls } = req.body;
    
    if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Se requiere al menos una reserva'
      });
    }

    // Obtener información de las reservas
    const [reservations] = await conn.query(`
      SELECT 
        tr.*,
        tt.name as ticket_type_name,
        tt.price_cents,
        e.name as event_name,
        e.id as event_id
      FROM ticket_reservations tr
      JOIN ticket_types tt ON tr.ticket_type_id = tt.id
      JOIN events e ON tt.event_id = e.id
      WHERE tr.id IN (?) AND tr.status = 'ACTIVE' AND tr.expires_at > NOW()
    `, [reservationIds]);

    if (reservations.length === 0) {
      return res.status(404).json({
        error: 'ReservationsNotFound',
        message: 'No se encontraron reservas válidas'
      });
    }

    // Preparar items para MercadoPago
    const items = reservations.map((reservation, index) => ({
      id: `reservation_${reservation.id}`,
      title: `${reservation.event_name} - ${reservation.ticket_type_name}`,
      description: `${reservation.quantity} entrada(s) para ${reservation.event_name}`,
      quantity: reservation.quantity,
      unit_price: reservation.price_cents
    }));

    const totalAmount = reservations.reduce((sum, r) => sum + (r.price_cents * r.quantity), 0);

    // Crear preferencia en MercadoPago
    const preference = await mercadoPagoService.createPreference({
      orderId: reservationIds.join(','), // Usar IDs de reserva como referencia
      items,
      payer,
      backUrls,
      metadata: {
        reservation_ids: reservationIds,
        total_reservations: reservations.length
      }
    });

    res.status(201).json({
      reservationIds,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      totalAmount,
      totalAmountFormatted: (totalAmount / 100).toFixed(2),
      itemCount: reservations.reduce((sum, r) => sum + r.quantity, 0)
    });

  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

// Crear preferencia de pago (método original para compatibilidad)
exports.createPaymentPreference = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { error, value } = createPaymentSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'ValidationError',
        message: error.details[0].message
      });
    }

    const { orderId, payer, backUrls } = value;

    // Verificar que la orden existe y está pendiente
    const [[order]] = await conn.query(
      `SELECT o.id, o.user_id, o.status, o.total_cents, 
              COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = ? AND o.status = 'PENDING'
       GROUP BY o.id`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({
        error: 'OrderNotFound',
        message: 'Orden no encontrada o ya procesada'
      });
    }

    // Obtener items de la orden
    const [orderItems] = await conn.query(
      `SELECT oi.*, s.sector, s.row_label, s.seat_number, 
              e.name as event_name, sh.starts_at
       FROM order_items oi
       JOIN seats s ON oi.seat_id = s.id
       JOIN shows sh ON s.show_id = sh.id
       JOIN events e ON sh.event_id = e.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // Preparar items para MercadoPago
    const items = orderItems.map((item, index) => ({
      id: `seat_${item.seat_id}`,
      title: `${item.event_name} - ${item.sector}${item.row_label}${item.seat_number}`,
      description: `Entrada para ${item.event_name} - Función: ${new Date(item.starts_at).toLocaleString()}`,
      quantity: 1,
      unit_price: item.unit_price_cents
    }));

    // Crear preferencia en MercadoPago
    const preference = await mercadoPagoService.createPreference({
      orderId,
      items,
      payer,
      backUrls,
      metadata: {
        user_id: order.user_id,
        item_count: order.item_count
      }
    });

    // Guardar referencia de pago
    await conn.query(
      `INSERT INTO payment_preferences (order_id, mp_preference_id, status, created_at)
       VALUES (?, ?, 'CREATED', NOW())`,
      [orderId, preference.id]
    );

    res.status(201).json({
      orderId,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      totalAmount: order.total_cents,
      itemCount: order.item_count
    });

  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

// Webhook de MercadoPago
exports.handleWebhook = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const webhookData = await mercadoPagoService.processWebhook(req.body, req.headers);
    
    if (!webhookData || webhookData.type !== 'payment') {
      return res.status(200).json({ received: true });
    }

    const { paymentId, status, externalReference, transactionAmount, dateApproved } = webhookData;
    
    if (!externalReference) {
      console.log('Webhook sin external_reference:', paymentId);
      return res.status(200).json({ received: true });
    }

    await conn.beginTransaction();

    // Verificar si es una reserva de tickets (nuevo sistema) o una orden (sistema anterior)
    const isReservationPayment = externalReference.includes(',');
    
    if (isReservationPayment) {
      // Nuevo sistema de reservas de tickets
      const reservationIds = externalReference.split(',').map(id => parseInt(id));
      
      // Obtener información de las reservas
      const [reservations] = await conn.query(`
        SELECT tr.*, tt.price_cents, tt.event_id
        FROM ticket_reservations tr
        JOIN ticket_types tt ON tr.ticket_type_id = tt.id
        WHERE tr.id IN (?)
      `, [reservationIds]);

      if (reservations.length === 0) {
        console.log('Reservas no encontradas:', reservationIds);
        return res.status(200).json({ received: true });
      }

      // Registrar el pago
      const totalAmount = reservations.reduce((sum, r) => sum + (r.price_cents * r.quantity), 0);
      
      await conn.query(`
        INSERT INTO payments (order_id, mp_payment_id, status, amount_cents, approved_at, webhook_data)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        status = VALUES(status),
        approved_at = VALUES(approved_at),
        webhook_data = VALUES(webhook_data)
      `, [
        null, // No hay order_id para reservas
        paymentId,
        status,
        Math.round(transactionAmount * 100),
        dateApproved ? new Date(dateApproved) : null,
        JSON.stringify({ ...webhookData, reservation_ids: reservationIds })
      ]);

      if (status === 'approved') {
        // Marcar reservas como pagadas
        await conn.query(`
          UPDATE ticket_reservations 
          SET status = 'PURCHASED', updated_at = NOW()
          WHERE id IN (?)
        `, [reservationIds]);

        // Generar tickets individuales
        for (const reservation of reservations) {
          for (let i = 0; i < reservation.quantity; i++) {
            const ticketNumber = `${reservation.ticket_type_id}-${Date.now()}-${i}`;
            const qrPayload = Buffer.from(JSON.stringify({
              reservationId: reservation.id,
              ticketTypeId: reservation.ticket_type_id,
              eventId: reservation.event_id,
              paymentId,
              ticketNumber,
              customerEmail: reservation.customer_email,
              nbf: Math.floor(Date.now() / 1000),
              exp: Math.floor((Date.now() + 365 * 24 * 3600 * 1000) / 1000) // 1 año
            })).toString('base64');

            await conn.query(`
              INSERT INTO generated_tickets (reservation_id, ticket_type_id, ticket_number, qr_code, status)
              VALUES (?, ?, ?, ?, 'ISSUED')
            `, [reservation.id, reservation.ticket_type_id, ticketNumber, qrPayload]);
          }
        }
      } else if (status === 'cancelled' || status === 'rejected') {
        // Marcar reservas como canceladas
        await conn.query(`
          UPDATE ticket_reservations 
          SET status = 'CANCELLED', updated_at = NOW()
          WHERE id IN (?)
        `, [reservationIds]);
      }
    } else {
      // Sistema anterior de órdenes
      const orderId = parseInt(externalReference);

      // Registrar el pago
      await conn.query(
        `INSERT INTO payments (order_id, mp_payment_id, status, amount_cents, approved_at, webhook_data)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         status = VALUES(status),
         approved_at = VALUES(approved_at),
         webhook_data = VALUES(webhook_data)`,
        [
          orderId,
          paymentId,
          status,
          Math.round(transactionAmount * 100), // Convertir a centavos
          dateApproved ? new Date(dateApproved) : null,
          JSON.stringify(webhookData)
        ]
      );

      // Actualizar estado de la orden según el pago
      if (status === 'approved') {
        await conn.query(
          `UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );

        // Generar tickets si no existen
        const [existingTickets] = await conn.query(
          `SELECT COUNT(*) as count FROM tickets WHERE order_id = ?`,
          [orderId]
        );

        if (existingTickets[0].count === 0) {
          // Obtener asientos de la orden
          const [seats] = await conn.query(
            `SELECT oi.seat_id, s.show_id 
             FROM order_items oi 
             JOIN seats s ON oi.seat_id = s.id 
             WHERE oi.order_id = ?`,
            [orderId]
          );

          // Crear tickets
          for (const seat of seats) {
            const payload = Buffer.from(JSON.stringify({
              orderId,
              seatId: seat.seat_id,
              showId: seat.show_id,
              paymentId,
              nbf: Math.floor(Date.now() / 1000),
              exp: Math.floor((Date.now() + 24 * 3600 * 1000) / 1000)
            })).toString('base64');

            await conn.query(
              `INSERT INTO tickets (order_id, seat_id, status, qr_payload)
               VALUES (?, ?, 'ISSUED', ?)`,
              [orderId, seat.seat_id, payload]
            );
          }
        }
      } else if (status === 'cancelled' || status === 'rejected') {
        await conn.query(
          `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );

        // Liberar asientos
        await conn.query(
          `UPDATE seats s 
           JOIN order_items oi ON s.id = oi.seat_id 
           SET s.status = 'AVAILABLE', s.reserved_by = NULL, s.reserved_until = NULL
           WHERE oi.order_id = ?`,
          [orderId]
        );
      }
    }

    await conn.commit();
    
    res.status(200).json({ received: true, processed: true });

  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  } finally {
    conn.release();
  }
};

// Obtener estado de pago de una orden
exports.getPaymentStatus = async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);

    const [[payment]] = await pool.query(
      `SELECT p.*, o.status as order_status, o.total_cents
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE p.order_id = ?
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [orderId]
    );

    if (!payment) {
      return res.status(404).json({
        error: 'PaymentNotFound',
        message: 'No se encontró información de pago para esta orden'
      });
    }

    res.json({
      orderId,
      paymentId: payment.mp_payment_id,
      status: payment.status,
      orderStatus: payment.order_status,
      amount: payment.amount_cents,
      approvedAt: payment.approved_at,
      createdAt: payment.created_at
    });

  } catch (error) {
    throw error;
  }
};

// Reembolsar pago
exports.refundPayment = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const orderId = Number(req.params.orderId);
    const { amount, reason } = req.body;

    // Obtener información del pago
    const [[payment]] = await conn.query(
      `SELECT * FROM payments WHERE order_id = ? AND status = 'approved'`,
      [orderId]
    );

    if (!payment) {
      return res.status(404).json({
        error: 'PaymentNotFound',
        message: 'No se encontró un pago aprobado para esta orden'
      });
    }

    // Procesar reembolso en MercadoPago
    const refund = await mercadoPagoService.refundPayment(
      payment.mp_payment_id,
      amount ? Math.round(amount * 100) : null // Convertir a centavos si se especifica
    );

    await conn.beginTransaction();

    // Registrar reembolso
    await conn.query(
      `INSERT INTO refunds (payment_id, mp_refund_id, amount_cents, reason, status, refund_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        refund.id,
        refund.amount * 100, // Convertir a centavos
        reason || 'Reembolso solicitado',
        refund.status,
        JSON.stringify(refund)
      ]
    );

    // Actualizar orden si es reembolso completo
    if (!amount || amount >= payment.amount_cents / 100) {
      await conn.query(
        `UPDATE orders SET status = 'REFUNDED', updated_at = NOW() WHERE id = ?`,
        [orderId]
      );

      // Cancelar tickets
      await conn.query(
        `UPDATE tickets SET status = 'CANCELLED' WHERE order_id = ?`,
        [orderId]
      );
    }

    await conn.commit();

    res.json({
      orderId,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      message: 'Reembolso procesado exitosamente'
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
