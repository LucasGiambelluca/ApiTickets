-- Script para configurar MariaDB/MySQL para Ticketera
-- Ejecutar con: mysql -u root -p < setup-mariadb.sql

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS ticketera CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear usuario
CREATE USER IF NOT EXISTS 'ticketera_user'@'localhost' IDENTIFIED BY 'ticketera123';
CREATE USER IF NOT EXISTS 'ticketera_user'@'127.0.0.1' IDENTIFIED BY 'ticketera123';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON ticketera.* TO 'ticketera_user'@'localhost';
GRANT ALL PRIVILEGES ON ticketera.* TO 'ticketera_user'@'127.0.0.1';

-- Recargar privilegios
FLUSH PRIVILEGES;

-- Verificar que se creó correctamente
USE ticketera;
SHOW TABLES;

-- Mostrar usuarios
SELECT User, Host FROM mysql.user WHERE User = 'ticketera_user';
