# 📋 EJEMPLOS DE PAYLOADS JSON VÁLIDOS - API TICKETERA

## 🎫 EVENTOS (POST /api/events)

### Payload Mínimo Requerido
```json
{
  "name": "Concierto de Rock 2025",
  "startsAt": "2025-12-15T20:00:00Z"
}
```

### Payload Completo
```json
{
  "name": "Concierto de Rock 2025",
  "description": "El mejor concierto de rock del año con bandas internacionales",
  "startsAt": "2025-12-15T20:00:00Z",
  "venue_id": 1,
  "venue": "Estadio Nacional"
}
```

### Con Imagen (multipart/form-data)
```bash
curl -X POST "http://localhost:3000/api/events" \
  -F "name=Concierto de Rock 2025" \
  -F "startsAt=2025-12-15T20:00:00Z" \
  -F "description=El mejor concierto del año" \
  -F "venue_id=1" \
  -F "image=@/path/to/image.jpg"
```

---

## 🏟️ VENUES (POST /api/venues)

### Payload Requerido
```json
{
  "name": "Estadio Nacional",
  "address": "Av. Grecia 2001",
  "city": "Santiago",
  "max_capacity": 50000
}
```

### Payload Completo
```json
{
  "name": "Estadio Nacional",
  "address": "Av. Grecia 2001",
  "city": "Santiago",
  "max_capacity": 50000,
  "description": "El estadio más grande de Chile",
  "phone": "+56-2-2345-6789",
  "email": "info@estadionacional.cl",
  "website": "https://estadionacional.cl"
}
```

---

## 🛒 ÓRDENES (POST /api/orders)

### Payload Requerido
```json
{
  "userId": 123,
  "showId": 456,
  "seats": [
    {
      "sectionId": 1,
      "row": "A",
      "number": 15
    },
    {
      "sectionId": 1,
      "row": "A",
      "number": 16
    }
  ]
}
```

### Payload con Múltiples Asientos
```json
{
  "userId": 123,
  "showId": 456,
  "seats": [
    {
      "sectionId": 1,
      "row": "A",
      "number": 15,
      "price": 25000
    },
    {
      "sectionId": 1,
      "row": "A",
      "number": 16,
      "price": 25000
    },
    {
      "sectionId": 2,
      "row": "B",
      "number": 10,
      "price": 35000
    }
  ],
  "totalAmount": 85000,
  "currency": "CLP"
}
```

---

## 🎟️ TIPOS DE TICKETS (POST /api/ticket-types)

### Crear Tipo de Ticket
```json
{
  "event_id": 1,
  "name": "General",
  "description": "Entrada general al evento",
  "price": 15000,
  "stock": 1000,
  "sale_starts_at": "2025-10-01T10:00:00Z",
  "sale_ends_at": "2025-12-15T18:00:00Z"
}
```

### Múltiples Tipos de Tickets
```json
[
  {
    "event_id": 1,
    "name": "General",
    "description": "Entrada general",
    "price": 15000,
    "stock": 1000,
    "sale_starts_at": "2025-10-01T10:00:00Z",
    "sale_ends_at": "2025-12-15T18:00:00Z"
  },
  {
    "event_id": 1,
    "name": "VIP",
    "description": "Acceso VIP con beneficios exclusivos",
    "price": 45000,
    "stock": 200,
    "sale_starts_at": "2025-10-01T10:00:00Z",
    "sale_ends_at": "2025-12-15T18:00:00Z"
  }
]
```

---

## ⚙️ CONFIGURACIÓN MERCADOPAGO (PUT /api/admin/settings/mercadopago)

### Configuración de Prueba
```json
{
  "accessToken": "TEST-1234567890-abcdef-ghijklmnop-qrstuvwxyz",
  "publicKey": "TEST-12345678-1234-1234-1234-123456789012"
}
```

### Configuración de Producción
```json
{
  "accessToken": "APP_USR-1234567890-abcdef-ghijklmnop-qrstuvwxyz",
  "publicKey": "APP_USR-12345678-1234-1234-1234-123456789012"
}
```

---

## 💰 CONFIGURACIÓN DE TARIFAS (PUT /api/admin/settings/fixed-fee)

```json
{
  "fixedFeeCents": 250
}
```

---

## 🎫 RESERVA DE TICKETS (POST /api/tickets/reserve)

```json
{
  "ticket_type_id": 1,
  "quantity": 2,
  "user_email": "usuario@example.com",
  "user_name": "Juan Pérez"
}
```

---

## 📊 EJEMPLOS DE CURL PARA TESTING

### Crear Evento
```bash
curl -X POST "http://localhost:3000/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concierto de Rock 2025",
    "startsAt": "2025-12-15T20:00:00Z",
    "description": "El mejor concierto del año"
  }'
```

### Crear Venue
```bash
curl -X POST "http://localhost:3000/api/venues" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Estadio Nacional",
    "address": "Av. Grecia 2001",
    "city": "Santiago",
    "max_capacity": 50000
  }'
```

### Crear Orden
```bash
curl -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 123,
    "showId": 456,
    "seats": [
      {
        "sectionId": 1,
        "row": "A",
        "number": 15
      }
    ]
  }'
```

### Configurar MercadoPago
```bash
curl -X PUT "http://localhost:3000/api/admin/settings/mercadopago" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "TEST-1234567890-abcdef-ghijklmnop-qrstuvwxyz",
    "publicKey": "TEST-12345678-1234-1234-1234-123456789012"
  }'
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Fechas**: Usar formato ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)
2. **IDs**: Usar números enteros positivos
3. **Precios**: En centavos (ej: 15000 = $150.00)
4. **Imágenes**: Usar multipart/form-data para subir archivos
5. **Validaciones**: Los campos marcados como requeridos son obligatorios

---

## 🔍 TESTING RÁPIDO

Para testear rápidamente todos los endpoints, ejecuta:

```bash
# 1. Crear venue
curl -X POST "http://localhost:3000/api/venues" -H "Content-Type: application/json" -d '{"name":"Test Venue","address":"Test Address 123","city":"Test City","max_capacity":1000}'

# 2. Crear evento
curl -X POST "http://localhost:3000/api/events" -H "Content-Type: application/json" -d '{"name":"Test Event","startsAt":"2025-12-15T20:00:00Z"}'

# 3. Listar eventos
curl -X GET "http://localhost:3000/api/events"

# 4. Health check
curl -X GET "http://localhost:3000/health"
```
