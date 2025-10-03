-- Productoras
CREATE TABLE IF NOT EXISTS producers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  contact_email VARCHAR(160),
  owner_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recintos
CREATE TABLE IF NOT EXISTS venues (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  capacity_min INT NOT NULL DEFAULT 0,
  capacity_max INT NOT NULL,
  address VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agregar columnas a events (sin IF NOT EXISTS)
ALTER TABLE events
  ADD COLUMN venue_id BIGINT UNSIGNED NULL,
  ADD COLUMN producer_id BIGINT UNSIGNED NULL;

-- Claves foráneas
ALTER TABLE events
  ADD CONSTRAINT fk_events_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
  ADD CONSTRAINT fk_events_producer FOREIGN KEY (producer_id) REFERENCES producers(id);

-- Secciones por show
CREATE TABLE IF NOT EXISTS show_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  show_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  kind ENUM('GA','SEATED') NOT NULL DEFAULT 'GA',
  capacity INT NOT NULL,
  price_tier_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows(id),
  FOREIGN KEY (price_tier_id) REFERENCES price_tiers(id),
  UNIQUE KEY uniq_show_name (show_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Settings globales (cargo fijo por ticket)
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO settings (`key`,`value`) VALUES ('fixed_fee_cents','0')
ON DUPLICATE KEY UPDATE `value`=`value`;
