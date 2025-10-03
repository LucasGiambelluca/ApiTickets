const { pool } = require('../src/db');

exports.createProducer = async (req, res) => {
  const { name, contactEmail, ownerUserId } = req.body || {};
  const [r] = await pool.query(
    `INSERT INTO producers (name, contact_email, owner_user_id) VALUES (?,?,?)`,
    [name, contactEmail || null, ownerUserId || null]
  );
  res.status(201).json({ id: r.insertId, name, contactEmail, ownerUserId: ownerUserId || null });
};

// Búsqueda rápida de productores (por nombre o email)
exports.searchProducers = async (req, res) => {
  const { q = '', limit = 10 } = req.query;

  if (!q || String(q).trim().length < 2) {
    return res.json({ producers: [] });
  }

  const like = `%${q}%`;

  const [rows] = await pool.query(
    `SELECT id, name, contact_email AS contactEmail, created_at AS createdAt
     FROM producers
     WHERE name LIKE ? OR contact_email LIKE ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [like, like, parseInt(limit, 10)]
  );

  res.json({ producers: rows });
};
