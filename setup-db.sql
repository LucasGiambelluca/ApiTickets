-- Configuración de base de datos para Ticketera
CREATE DATABASE IF NOT EXISTS ticketera;
CREATE USER IF NOT EXISTS 'app'@'localhost' IDENTIFIED BY 'app';
GRANT ALL PRIVILEGES ON ticketera.* TO 'app'@'localhost';
FLUSH PRIVILEGES;

-- Verificar que se creó correctamente
USE ticketera;
SELECT 'Database ticketera created successfully' AS status;
