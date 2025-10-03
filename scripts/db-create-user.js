#!/usr/bin/env node
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';       // conectamos como root
  const password = process.env.DB_PASSWORD || '';
  const db = process.env.DB_NAME || 'ticketera';

  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`CREATE USER IF NOT EXISTS 'app'@'localhost' IDENTIFIED BY 'app';`);
  await conn.query(`GRANT ALL PRIVILEGES ON \`${db}\`.* TO 'app'@'localhost';`);
  await conn.query(`FLUSH PRIVILEGES;`);

  await conn.end();
  console.log("✅ Usuario 'app' creado con permisos sobre la DB:", db);
})().catch((e) => { console.error(e); process.exit(1); });
