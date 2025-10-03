-- Upgrade: Sistema de Tipos de Tickets
-- Este script agrega las tablas necesarias para manejar tipos de tickets por evento

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Tabla para tipos de tickets por evento
CREATE TABLE IF NOT EXISTS ticket_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_cents INT NOT NULL DEFAULT 0,
  quantity_total INT NOT NULL DEFAULT 0,
  quantity_sold INT NOT NULL DEFAULT 0,
  quantity_reserved INT NOT NULL DEFAULT 0,
  sale_start DATETIME NULL,
  sale_end DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_event_active (event_id, is_active),
  INDEX idx_sale_period (sale_start, sale_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla para reservas de tickets (antes de la compra)
CREATE TABLE IF NOT EXISTS ticket_reservations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_type_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(50),
  status ENUM('ACTIVE', 'EXPIRED', 'PURCHASED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE CASCADE,
  INDEX idx_status_expires (status, expires_at),
  INDEX idx_ticket_type (ticket_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla para tickets individuales generados después del pago
CREATE TABLE IF NOT EXISTS generated_tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reservation_id BIGINT UNSIGNED NOT NULL,
  ticket_type_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  qr_code TEXT NOT NULL,
  status ENUM('ISSUED', 'USED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'ISSUED',
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES ticket_reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_ticket_number (ticket_number),
  INDEX idx_status (status),
  INDEX idx_reservation (reservation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla para estadísticas de ventas por evento
CREATE TABLE IF NOT EXISTS event_sales_stats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  tickets_sold INT NOT NULL DEFAULT 0,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  unique_customers INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE KEY unique_event_date (event_id, date),
  INDEX idx_event_date (event_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agregar campos adicionales a la tabla events si no existen
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS total_capacity INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tickets_sold INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_cents BIGINT DEFAULT 0;

-- Agregar índices adicionales para optimizar consultas de reportes
ALTER TABLE orders 
ADD INDEX IF NOT EXISTS idx_created_at (created_at),
ADD INDEX IF NOT EXISTS idx_status_created (status, created_at);

ALTER TABLE payments 
ADD INDEX IF NOT EXISTS idx_approved_at (approved_at),
ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Trigger para actualizar estadísticas cuando se vende un ticket
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS update_ticket_stats_after_purchase
AFTER UPDATE ON ticket_reservations
FOR EACH ROW
BEGIN
  IF NEW.status = 'PURCHASED' AND OLD.status != 'PURCHASED' THEN
    -- Actualizar contador de tickets vendidos en ticket_types
    UPDATE ticket_types 
    SET quantity_sold = quantity_sold + NEW.quantity,
        quantity_reserved = quantity_reserved - NEW.quantity
    WHERE id = NEW.ticket_type_id;
    
    -- Actualizar estadísticas del evento
    INSERT INTO event_sales_stats (event_id, date, tickets_sold, revenue_cents, unique_customers)
    SELECT 
      tt.event_id,
      CURDATE(),
      NEW.quantity,
      (tt.price_cents * NEW.quantity),
      1
    FROM ticket_types tt
    WHERE tt.id = NEW.ticket_type_id
    ON DUPLICATE KEY UPDATE
      tickets_sold = tickets_sold + NEW.quantity,
      revenue_cents = revenue_cents + (VALUES(revenue_cents)),
      unique_customers = unique_customers + 1;
      
    -- Actualizar totales del evento
    UPDATE events e
    JOIN ticket_types tt ON e.id = tt.event_id
    SET e.tickets_sold = e.tickets_sold + NEW.quantity,
        e.revenue_cents = e.revenue_cents + (tt.price_cents * NEW.quantity)
    WHERE tt.id = NEW.ticket_type_id;
  END IF;
END$$

DELIMITER ;

-- Trigger para actualizar reservas cuando se crea una
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS update_reserved_count
AFTER INSERT ON ticket_reservations
FOR EACH ROW
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    UPDATE ticket_types 
    SET quantity_reserved = quantity_reserved + NEW.quantity
    WHERE id = NEW.ticket_type_id;
  END IF;
END$$

DELIMITER ;

-- Insertar algunos tipos de tickets de ejemplo para testing
INSERT IGNORE INTO ticket_types (event_id, name, description, price_cents, quantity_total, sale_start, sale_end) 
SELECT 
  e.id,
  'General',
  'Entrada general al evento',
  8000,
  500,
  DATE_SUB(NOW(), INTERVAL 30 DAY),
  DATE_ADD(NOW(), INTERVAL 30 DAY)
FROM events e 
LIMIT 3;

INSERT IGNORE INTO ticket_types (event_id, name, description, price_cents, quantity_total, sale_start, sale_end) 
SELECT 
  e.id,
  'VIP',
  'Acceso VIP con beneficios especiales',
  15000,
  100,
  DATE_SUB(NOW(), INTERVAL 30 DAY),
  DATE_ADD(NOW(), INTERVAL 30 DAY)
FROM events e 
LIMIT 3;

-- Crear vista para reportes rápidos
CREATE OR REPLACE VIEW event_sales_summary AS
SELECT 
  e.id as event_id,
  e.name as event_name,
  e.total_capacity,
  e.tickets_sold,
  e.revenue_cents,
  COUNT(DISTINCT tt.id) as ticket_types_count,
  SUM(tt.quantity_total) as total_tickets_available,
  SUM(tt.quantity_sold) as total_tickets_sold,
  SUM(tt.quantity_reserved) as total_tickets_reserved,
  (SUM(tt.quantity_total) - SUM(tt.quantity_sold) - SUM(tt.quantity_reserved)) as tickets_available,
  ROUND((SUM(tt.quantity_sold) * 100.0 / NULLIF(SUM(tt.quantity_total), 0)), 2) as occupancy_percentage
FROM events e
LEFT JOIN ticket_types tt ON e.id = tt.event_id AND tt.is_active = TRUE
GROUP BY e.id, e.name, e.total_capacity, e.tickets_sold, e.revenue_cents;
