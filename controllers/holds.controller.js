const { pool } = require('../src/db');

const HOLD_MINUTES = Number(process.env.HOLD_MINUTES || 7);

exports.createHold = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const showId = Number(req.params.id);
    const { userId, seats, minutes } = req.body || {};
    const ttlMin = Number(minutes || HOLD_MINUTES);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await conn.beginTransaction();

    // Lock filas candidatas
    const [locked] = await conn.query(
      `SELECT id, status, reserved_until FROM seats
       WHERE show_id = ? AND id IN (?) FOR UPDATE`,
      [showId, seats]
    );
    if (locked.length !== seats.length) {
      const err = new Error('Asientos inexistentes');
      err.status = 404; err.code = 'SeatsNotFound';
      throw err;
    }

    const now = new Date();
    const conflict = locked.find(r =>
      r.status !== 'AVAILABLE' ||
      (r.reserved_until && new Date(r.reserved_until) > now)
    );
    if (conflict) {
      const err = new Error('Alguno ya está reservado o vendido');
      err.status = 409; err.code = 'SeatAlreadyHeldOrSold';
      throw err;
    }

    await conn.query(
      `UPDATE seats
       SET reserved_by = ?, reserved_until = ?
       WHERE show_id = ? AND id IN (?)`,
      [userId, expiresAt, showId, seats]
    );

    await conn.commit();
    res.json({ status: 'held', showId, seats, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
};
