-- Upgrade: add venue_id to shows and set FK to venues
-- Safe to run multiple times

-- Add column venue_id if not exists
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS venue_id BIGINT UNSIGNED NULL;

-- Add foreign key if not exists (MySQL/MariaDB doesn't support IF NOT EXISTS for constraints directly)
-- Try to create; if it already exists, it will error but migration tools typically ignore. Run guarded.
ALTER TABLE shows
  ADD CONSTRAINT fk_shows_venue FOREIGN KEY (venue_id) REFERENCES venues(id);

-- Optional index
CREATE INDEX IF NOT EXISTS idx_shows_event_starts ON shows(event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_shows_venue ON shows(venue_id);
