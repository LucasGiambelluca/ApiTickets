INSERT INTO users (email, name, role) VALUES ('organizer@example.com','Org','ORGANIZER');
INSERT INTO events (name, organizer_id, venue) VALUES ('Show Demo', 1, 'Teatro Central');
INSERT INTO shows (event_id, starts_at) VALUES (1, '2025-09-01 20:00:00');
INSERT INTO price_tiers (show_id, name, price_cents) VALUES (1, 'General', 150000);

-- 10 asientos
INSERT INTO seats (show_id, sector, row_label, seat_number, price_tier_id) VALUES
 (1,'A','A','1',1),(1,'A','A','2',1),(1,'A','A','3',1),(1,'A','A','4',1),(1,'A','A','5',1),
 (1,'A','A','6',1),(1,'A','A','7',1),(1,'A','A','8',1),(1,'A','A','9',1),(1,'A','A','10',1);
