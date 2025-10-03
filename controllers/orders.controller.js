const { pool } = require('../src/db');

exports.createOrder = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { userId, showId, seats } = req.body || {};
    const now = new Date();

    await conn.beginTransaction();

    // Fee fijo (admin)
    const [[feeRow]] = await conn.query("SELECT `value` FROM settings WHERE `key`='fixed_fee_cents' LIMIT 1");
    const fixedFee = parseInt(feeRow?.value || '0', 10) || 0;

    const [rows] = await conn.query(
      `SELECT s.id, s.status, s.reserved_by, s.reserved_until, COALESCE(pt.price_cents,0) AS price_cents
         FROM seats s
         LEFT JOIN price_tiers pt ON s.price_tier_id = pt.id
        WHERE s.show_id = ? AND s.id IN (?) FOR UPDATE`,
      [showId, seats]
    );
    if (rows.length !== seats.length) { const err = new Error('Asientos inexistentes'); err.status=404; err.code='SeatsNotFound'; throw err; }

    for (const r of rows) {
      if (r.status !== 'AVAILABLE') { const err=new Error(`Asiento ${r.id} ya vendido`); err.status=409; err.code='SeatAlreadySold'; throw err; }
      if (r.reserved_by !== userId || !r.reserved_until || new Date(r.reserved_until) <= now) {
        const err=new Error(`Reserva inválida/expirada ${r.id}`); err.status=409; err.code='HoldMissingOrExpired'; throw err;
      }
    }

    // total = precio base + fee fijo por cada ticket
    const total = rows.reduce((acc, r) => acc + (r.price_cents + fixedFee), 0);

    // Crear orden en estado PENDING (no PAID hasta que se confirme el pago)
    const [orderRes] = await conn.query(`INSERT INTO orders (user_id, status, total_cents) VALUES (?, 'PENDING', ?)`, [userId, total]);
    const orderId = orderRes.insertId;

    // Crear items de la orden
    for (const r of rows) {
      const unit = (r.price_cents + fixedFee);
      await conn.query(`INSERT INTO order_items (order_id, seat_id, unit_price_cents) VALUES (?, ?, ?)`, [orderId, r.id, unit]);
    }

    // NO marcar asientos como vendidos ni generar tickets hasta que se confirme el pago
    // Los asientos permanecen reservados hasta que expire la reserva o se confirme el pago

    await conn.commit();
    res.json({ 
      orderId, 
      status: 'PENDING', 
      totalCents: total, 
      seats, 
      fixedFeeCents: fixedFee,
      message: 'Orden creada. Procede al pago para confirmar.'
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally { conn.release(); }
};
