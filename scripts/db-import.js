#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node scripts/db-import.js <archivo.sql>');
    process.exit(1);
  }
  const sqlPath = path.resolve(file);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'ticketera';

  const conn = await mysql.createConnection({
    host, port, user, password,
    multipleStatements: true, // ok para entorno local
    charset: 'utf8mb4'
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`USE \`${dbName}\`;`);
  await conn.query(sql);

  console.log(`Importado: ${sqlPath} -> ${dbName}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
