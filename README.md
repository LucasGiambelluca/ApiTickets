# 🎫 Ticketera API

Sistema completo de venta de tickets con cola virtual y pasarela de pagos integrada.

## 🚀 Características

- **Gestión de Eventos y Shows**: Crear y administrar eventos con múltiples funciones
- **Sistema de Asientos**: Manejo de sectores, filas y asientos individuales
- **Cola Virtual con Redis**: Sistema de cola para controlar acceso durante alta demanda
- **Pasarela de Pagos**: Integración completa con MercadoPago
- **Reservas Temporales**: Sistema de holds para asegurar asientos durante el proceso de compra
- **Tickets Digitales**: Generación automática de tickets con códigos QR
- **Webhooks**: Procesamiento automático de notificaciones de pago

## 📋 Requisitos Previos

- **Node.js** >= 16.0.0
- **MySQL/MariaDB** >= 8.0
- **Redis** >= 6.0
- **Cuenta de MercadoPago** (para pagos)

## 🛠️ Instalación

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd ticketera
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia el archivo `.env` y configura las variables:

```bash
# Servidor
PORT=3000

# Base de datos MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=app
DB_PASSWORD=app
DB_NAME=ticketera

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# MercadoPago
MP_ACCESS_TOKEN=your_mercadopago_access_token_here
MP_PUBLIC_KEY=your_mercadopago_public_key_here
MP_WEBHOOK_SECRET=your_webhook_secret_here

# Configuración de cola
QUEUE_MAX_SIZE=1000
QUEUE_TIMEOUT_MINUTES=15
HOLD_MINUTES=7

# URLs permitidas (CORS)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
BASE_URL=http://localhost:3000
```

### 4. Configurar base de datos

#### Crear usuario de base de datos:
```bash
node scripts/db-create-user.js
```

#### Crear esquema:
```bash
npm run db:schema
```

#### Ejecutar upgrade (tablas adicionales):
```bash
node scripts/db-import.js sql/upgrade_venues_producers_sections.sql
```

#### Cargar datos de prueba:
```bash
npm run db:seed
```

### 5. Iniciar Redis
```bash
# En Ubuntu/Debian
sudo systemctl start redis-server

# En macOS con Homebrew
brew services start redis

# En Windows con Docker
docker run -d -p 6379:6379 redis:alpine
```

### 6. Iniciar la aplicación
```bash
npm start
```

La API estará disponible en `http://localhost:3000`

## 📚 Documentación de API

### 🏥 Health Check
```http
GET /health
```

### 🎭 Eventos
```http
# Crear evento con show
POST /api/events
{
  "name": "Concierto Rock",
  "producerId": 1,
  "venueId": 1,
  "startsAt": "2024-12-31T20:00:00Z"
}
```

### 🎪 Shows
```http
# Listar shows
GET /api/shows

# Obtener show específico
GET /api/shows/:id

# Obtener asientos de un show
GET /api/shows/:id/seats
```

### 🪑 Reservas (Holds)
```http
# Crear reserva temporal
POST /api/shows/:id/holds
{
  "userId": "user123",
  "seats": [1, 2, 3],
  "minutes": 10
}
```

### 🏟️ Secciones
```http
# Crear sección en un show
POST /api/shows/:showId/sections
{
  "name": "Platea",
  "kind": "SEATED",
  "capacity": 100,
  "priceCents": 150000
}
```

### 🛒 Órdenes
```http
# Crear orden
POST /api/orders
{
  "userId": "user123",
  "showId": 1,
  "seats": [1, 2, 3]
}
```

### 🚶‍♂️ Cola Virtual
```http
# Unirse a la cola
POST /api/queue/:showId/join
{
  "userId": "user123",
  "userInfo": {
    "name": "Juan Pérez",
    "email": "juan@example.com"
  }
}

# Verificar posición en cola
GET /api/queue/:showId/position?userId=user123

# Obtener estado de la cola
GET /api/queue/:showId/status

# Procesar siguiente en cola (admin)
POST /api/queue/:showId/process-next

# Salir de la cola
DELETE /api/queue/:showId/leave
{
  "userId": "user123"
}
```

### 💳 Pagos
```http
# Crear preferencia de pago
POST /api/payments/preference
{
  "orderId": 123,
  "payer": {
    "name": "Juan",
    "surname": "Pérez",
    "email": "juan@example.com"
  },
  "backUrls": {
    "success": "https://yoursite.com/success",
    "failure": "https://yoursite.com/failure",
    "pending": "https://yoursite.com/pending"
  }
}

# Webhook de MercadoPago (configurar en MP)
POST /api/payments/webhook

# Obtener estado de pago
GET /api/payments/order/:orderId/status

# Reembolsar pago
POST /api/payments/order/:orderId/refund
{
  "reason": "Cancelación del evento"
}
```

## 🔄 Flujo Completo de Compra

### 1. **Crear Evento y Show**
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concierto de Rock",
    "startsAt": "2024-12-31T20:00:00Z"
  }'
```

### 2. **Crear Secciones**
```bash
curl -X POST http://localhost:3000/api/shows/1/sections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Platea",
    "kind": "SEATED",
    "capacity": 10,
    "priceCents": 150000
  }'
```

### 3. **Unirse a la Cola Virtual**
```bash
curl -X POST http://localhost:3000/api/queue/1/join \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "userInfo": {
      "name": "Juan Pérez",
      "email": "juan@example.com"
    }
  }'
```

### 4. **Procesar Cola (Admin)**
```bash
curl -X POST http://localhost:3000/api/queue/1/process-next
```

### 5. **Crear Reserva**
```bash
curl -X POST http://localhost:3000/api/shows/1/holds \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "seats": [1, 2],
    "minutes": 10
  }'
```

### 6. **Crear Orden**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "showId": 1,
    "seats": [1, 2]
  }'
```

### 7. **Crear Preferencia de Pago**
```bash
curl -X POST http://localhost:3000/api/payments/preference \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 1,
    "payer": {
      "name": "Juan",
      "surname": "Pérez",
      "email": "juan@example.com"
    },
    "backUrls": {
      "success": "https://yoursite.com/success",
      "failure": "https://yoursite.com/failure",
      "pending": "https://yoursite.com/pending"
    }
  }'
```

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Ticketera     │    │   MercadoPago   │
│                 │    │      API        │    │                 │
│  - React/Vue    │◄──►│                 │◄──►│  - Payments     │
│  - Queue UI     │    │  - Express.js   │    │  - Webhooks     │
│  - Checkout     │    │  - MySQL        │    │                 │
└─────────────────┘    │  - Redis Queue  │    └─────────────────┘
                       │  - JWT Auth     │
                       └─────────────────┘
                              │
                       ┌─────────────────┐
                       │     Redis       │
                       │                 │
                       │  - Queues       │
                       │  - Sessions     │
                       │  - Cache        │
                       └─────────────────┘
```

## 🔧 Configuración de MercadoPago

1. **Crear cuenta en MercadoPago Developers**
2. **Obtener credenciales**:
   - Access Token
   - Public Key
3. **Configurar Webhook**:
   - URL: `https://yourdomain.com/api/payments/webhook`
   - Eventos: `payment`

## 🚀 Despliegue

### Variables de Entorno de Producción
```bash
NODE_ENV=production
PORT=3000
DB_HOST=your-db-host
REDIS_HOST=your-redis-host
MP_ACCESS_TOKEN=your-production-token
BASE_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourfrontend.com
```

### Docker (Opcional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

```bash
# Verificar salud del sistema
curl http://localhost:3000/health

# Probar creación de evento
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Event", "startsAt": "2024-12-31T20:00:00Z"}'
```

## 📊 Monitoreo

- **Health Check**: `/health` - Verifica estado de Redis y base de datos
- **Logs**: Usar `morgan` para logs de HTTP
- **Redis**: Monitorear memoria y conexiones
- **Base de Datos**: Monitorear queries lentas

## 🔒 Seguridad

- **CORS**: Configurado para dominios específicos
- **Rate Limiting**: Implementar según necesidades
- **Validación**: Joi para validar inputs
- **Sanitización**: Prevenir inyección SQL
- **HTTPS**: Obligatorio en producción

## 🐛 Troubleshooting

### Redis no conecta
```bash
# Verificar que Redis esté corriendo
redis-cli ping
# Debe responder: PONG
```

### Base de datos no conecta
```bash
# Verificar conexión MySQL
mysql -h localhost -u app -p ticketera
```

### MercadoPago webhook no funciona
1. Verificar URL pública accesible
2. Verificar credenciales
3. Revisar logs del webhook

## 📝 Licencia

MIT License

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch
3. Commit cambios
4. Push al branch
5. Crear Pull Request

---

**¿Necesitas ayuda?** Abre un issue en el repositorio.
# ApiTickets
# ApiTicketsRS
