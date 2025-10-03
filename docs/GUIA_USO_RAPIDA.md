# 🎫 Guía de Uso Rápida - Ticketera

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js 16+
- MySQL/MariaDB
- Redis (opcional)

### Instalación
```bash
# Clonar e instalar dependencias
npm install

# Configurar base de datos
npm run setup

# Iniciar servidor
npm start
```

La aplicación estará disponible en: http://localhost:3000

## 📱 Funcionalidades Principales

### 1. 👀 Ver Eventos

#### Desde la Web
1. Abre http://localhost:3000
2. Navega a la sección "Eventos"
3. Usa la barra de búsqueda para filtrar eventos
4. Haz clic en cualquier evento para ver detalles

#### Via API
```javascript
// Listar todos los eventos
GET /api/events?page=1&limit=20&search=concierto

// Buscar eventos (autocomplete)
GET /api/events/search?q=rock&limit=5

// Ver evento específico
GET /api/events/123
```

**Ejemplo de Respuesta:**
```json
{
  "events": [
    {
      "id": 1,
      "name": "Concierto de Rock",
      "venue_name": "Estadio Nacional",
      "next_show_date": "2024-03-15T20:00:00Z",
      "image_url": "/uploads/evento1.jpg"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### 2. ➕ Crear Eventos

#### Desde la Web
1. Ve a la sección "Admin"
2. Haz clic en "Crear Evento"
3. Completa el formulario:
   - Nombre del evento
   - Descripción
   - Venue (lugar)
   - Fecha y hora
   - Imagen (opcional)
4. Haz clic en "Crear Evento"

#### Via API
```javascript
// Crear evento con imagen
const formData = new FormData();
formData.append('name', 'Mi Concierto');
formData.append('description', 'Gran evento musical');
formData.append('venue_id', '1');
formData.append('startsAt', '2024-03-15T20:00:00Z');
formData.append('image', fileInput.files[0]);

fetch('/api/events', {
  method: 'POST',
  body: formData
});
```

### 3. 🎟️ Sistema de Tickets (NUEVO)

#### Crear Tipos de Tickets para un Evento
```javascript
// Crear categorías de tickets
POST /api/events/123/ticket-types
{
  "types": [
    {
      "name": "VIP",
      "description": "Acceso preferencial",
      "price": 15000,
      "quantity": 100,
      "sale_start": "2024-01-01T00:00:00Z",
      "sale_end": "2024-03-15T18:00:00Z"
    },
    {
      "name": "General",
      "description": "Entrada general",
      "price": 8000,
      "quantity": 500,
      "sale_start": "2024-01-01T00:00:00Z",
      "sale_end": "2024-03-15T18:00:00Z"
    }
  ]
}
```

#### Ver Tickets Disponibles
```javascript
GET /api/events/123/ticket-types
```

### 4. 🛒 Comprar Tickets

#### Flujo de Compra Completo

**Paso 1: Seleccionar Tickets**
```javascript
// Ver tickets disponibles
GET /api/events/123/ticket-types

// Respuesta
{
  "event": {
    "id": 123,
    "name": "Concierto de Rock"
  },
  "ticketTypes": [
    {
      "id": 1,
      "name": "VIP",
      "price": 15000,
      "available": 95,
      "total": 100
    }
  ]
}
```

**Paso 2: Crear Reserva**
```javascript
POST /api/tickets/reserve
{
  "eventId": 123,
  "tickets": [
    {
      "typeId": 1,
      "quantity": 2
    }
  ],
  "customerInfo": {
    "name": "Juan Pérez",
    "email": "juan@email.com",
    "phone": "+54911234567"
  }
}
```

**Paso 3: Procesar Pago**
```javascript
POST /api/payments/create-preference
{
  "reservationId": 456,
  "payer": {
    "name": "Juan",
    "surname": "Pérez",
    "email": "juan@email.com"
  },
  "backUrls": {
    "success": "http://localhost:3000/payment/success",
    "failure": "http://localhost:3000/payment/failure",
    "pending": "http://localhost:3000/payment/pending"
  }
}
```

**Paso 4: Confirmar Pago**
El webhook de MercadoPago se encarga automáticamente de:
- Confirmar el pago
- Generar los tickets con códigos QR
- Enviar confirmación por email (próximamente)

### 5. 📊 Ver Reportes de Eventos

#### Dashboard de Reportes
```javascript
GET /api/reports/event/123
```

**Respuesta Completa:**
```json
{
  "event": {
    "id": 123,
    "name": "Concierto de Rock",
    "date": "2024-03-15T20:00:00Z"
  },
  "sales": {
    "totalTickets": 150,
    "totalRevenue": 1650000,
    "ticketsSold": 150,
    "ticketsAvailable": 450
  },
  "breakdown": [
    {
      "ticketType": "VIP",
      "price": 15000,
      "sold": 50,
      "revenue": 750000,
      "percentage": 45.45
    },
    {
      "ticketType": "General",
      "price": 8000,
      "sold": 100,
      "revenue": 800000,
      "percentage": 48.48
    }
  ],
  "timeline": [
    {
      "date": "2024-01-15",
      "ticketsSold": 25,
      "revenue": 200000
    }
  ],
  "demographics": {
    "topCities": ["Buenos Aires", "Córdoba"],
    "ageGroups": {
      "18-25": 40,
      "26-35": 60,
      "36-45": 35
    }
  }
}
```

### 6. 🎯 Casos de Uso Comunes

#### Organizador de Eventos
1. **Crear evento**: Admin → Crear Evento
2. **Configurar tickets**: Definir tipos y precios
3. **Monitorear ventas**: Ver dashboard de reportes
4. **Gestionar capacidad**: Ajustar disponibilidad

#### Comprador de Tickets
1. **Buscar evento**: Usar barra de búsqueda
2. **Ver detalles**: Hacer clic en evento
3. **Seleccionar tickets**: Elegir tipo y cantidad
4. **Pagar**: Usar MercadoPago
5. **Recibir tickets**: Descargar PDF con QR

#### Administrador
1. **Configurar MercadoPago**: Admin → Configuración
2. **Ver todas las ventas**: Dashboard general
3. **Gestionar venues**: Crear y editar lugares
4. **Configurar tarifas**: Ajustar comisiones

## 🔧 Configuración Avanzada

### Variables de Entorno Importantes
```env
# Base de datos
DB_HOST=localhost
DB_USER=ticketera
DB_PASSWORD=tu_password
DB_NAME=ticketera

# MercadoPago
MP_ACCESS_TOKEN=tu_access_token
MP_PUBLIC_KEY=tu_public_key

# Servidor
PORT=3000
ALLOWED_ORIGINS=*
```

### Comandos Útiles
```bash
# Ver estado del sistema
npm run health

# Resetear base de datos
npm run db:reset

# Ver logs en tiempo real
npm run logs

# Limpiar Redis
npm run redis:flush
```

## 🆘 Solución de Problemas

### Error: "Evento no encontrado"
- Verifica que el ID del evento sea correcto
- Asegúrate de que el evento tenga shows asociados

### Error: "Tickets no disponibles"
- Verifica que haya stock disponible
- Confirma que la venta esté activa (dentro del período)

### Error de Pago
- Verifica configuración de MercadoPago
- Revisa los logs del webhook: `npm run logs`

### Base de Datos
- Ejecuta health check: `GET /health`
- Reinicia servicios: `npm run docker:up`

## 📞 Soporte

Para más información, consulta:
- **Documentación técnica**: `/docs/API_ENDPOINTS.md`
- **Logs del sistema**: `npm run logs`
- **Health check**: http://localhost:3000/health

---

*¡Ticketera está listo para gestionar tus eventos! 🎉*
