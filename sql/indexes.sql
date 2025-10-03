-- Índices optimizados para Ticketera
-- Ejecutar después del schema principal para máximo rendimiento

-- Índices para tabla seats (crítica para performance)
CREATE INDEX idx_seats_show_status ON seats(show_id, status);
CREATE INDEX idx_seats_reserved_until ON seats(reserved_until) WHERE reserved_until IS NOT NULL;
CREATE INDEX idx_seats_reserved_by ON seats(reserved_by) WHERE reserved_by IS NOT NULL;
CREATE INDEX idx_seats_show_sector_row ON seats(show_id, sector, row_label);

-- Índices para tabla shows
CREATE INDEX idx_shows_starts_at ON shows(starts_at);
CREATE INDEX idx_shows_status_starts ON shows(status, starts_at);
CREATE INDEX idx_shows_event_starts ON shows(event_id, starts_at);

-- Índices para tabla orders
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Índices para tabla order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_seat_id ON order_items(seat_id);

-- Índices para tabla payments
CREATE INDEX idx_payments_order_status ON payments(order_id, status);
CREATE INDEX idx_payments_mp_payment_id ON payments(mp_payment_id);
CREATE INDEX idx_payments_status_created ON payments(status, created_at);

-- Índices para tabla tickets
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_seat_id ON tickets(seat_id);

-- Índices para tabla events
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_producer_id ON events(producer_id);
CREATE INDEX idx_events_venue_id ON events(venue_id);

-- Índices para tabla price_tiers
CREATE INDEX idx_price_tiers_show_id ON price_tiers(show_id);

-- Índices compuestos para queries complejas
CREATE INDEX idx_seats_complex_query ON seats(show_id, status, price_tier_id);
CREATE INDEX idx_orders_user_status_date ON orders(user_id, status, created_at);

-- Índices para búsquedas de texto (si se necesitan)
-- CREATE FULLTEXT INDEX idx_events_name_fulltext ON events(name);

-- Estadísticas para el optimizador
ANALYZE TABLE seats;
ANALYZE TABLE shows;
ANALYZE TABLE orders;
ANALYZE TABLE order_items;
ANALYZE TABLE payments;
ANALYZE TABLE tickets;
ANALYZE TABLE events;
