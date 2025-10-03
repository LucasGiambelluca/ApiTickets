-- Migración para agregar soporte de imágenes y venues completos
-- Ejecutar después del schema.sql existente

-- 1. Crear tabla venues con información completa
CREATE TABLE IF NOT EXISTS venues (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(300) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) NOT NULL DEFAULT 'Argentina',
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8) NULL,
  longitude DECIMAL(11, 8) NULL,
  max_capacity INT UNSIGNED NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  email VARCHAR(160),
  website VARCHAR(300),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_city (city),
  INDEX idx_location (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Agregar campos de imagen a la tabla events
ALTER TABLE events 
ADD COLUMN image_url VARCHAR(500) NULL AFTER venue,
ADD COLUMN image_filename VARCHAR(255) NULL AFTER image_url,
ADD COLUMN description TEXT NULL AFTER image_filename,
ADD COLUMN venue_id BIGINT UNSIGNED NULL AFTER description,
ADD FOREIGN KEY (venue_id) REFERENCES venues(id);

-- 3. Crear índices para mejorar performance
ALTER TABLE events ADD INDEX idx_venue_id (venue_id);

-- 4. Insertar algunos venues de ejemplo para Argentina
INSERT INTO venues (name, address, city, state, country, max_capacity, description) VALUES
('Teatro Colón', 'Cerrito 628', 'Buenos Aires', 'CABA', 'Argentina', 2487, 'Uno de los teatros de ópera más importantes del mundo'),
('Luna Park', 'Av. Eduardo Madero 470', 'Buenos Aires', 'CABA', 'Argentina', 8500, 'Estadio cubierto histórico de Buenos Aires'),
('Movistar Arena', 'Humboldt 450', 'Buenos Aires', 'CABA', 'Argentina', 15000, 'Arena moderna para eventos y conciertos'),
('Centro Cultural Recoleta', 'Junín 1930', 'Buenos Aires', 'CABA', 'Argentina', 500, 'Centro cultural con múltiples salas'),
('Estadio River Plate', 'Av. Pres. Figueroa Alcorta 7597', 'Buenos Aires', 'CABA', 'Argentina', 70074, 'Estadio de fútbol, también usado para conciertos');
