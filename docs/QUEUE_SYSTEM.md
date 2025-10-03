# 🎫 Sistema de Colas Virtuales - Ticketera

## 📋 Descripción General

El sistema de colas virtuales permite gestionar el acceso a la compra de tickets cuando hay alta demanda, evitando la sobrecarga del servidor y proporcionando una experiencia ordenada a los usuarios.

## 🔧 Configuración

### Variables de Entorno Requeridas:
```bash
# Redis (requerido para colas)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=           # Opcional

# Configuración de Cola
QUEUE_MAX_SIZE=1000       # Tamaño máximo de cola por show
QUEUE_TIMEOUT_MINUTES=15  # Tiempo de expiración en cola
```

### Verificar Estado:
```bash
GET /health
```

## 🚀 Endpoints de la API

### 1. Unirse a la Cola
```http
POST /api/queue/:showId/join
Content-Type: application/json

{
  "userId": "string",
  "userInfo": {
    "name": "string",
    "email": "string"
  }
}
```

**Respuesta Exitosa (201):**
```json
{
  "message": "Agregado a la cola exitosamente",
  "success": true,
  "position": 15,
  "sessionId": "uuid-v4",
  "estimatedWaitTime": 450,
  "queueSize": 15
}
```

**Errores:**
- `409` - Usuario ya está en una cola
- `503` - Cola llena

### 2. Obtener Posición en la Cola
```http
GET /api/queue/:showId/position?userId=string
```

**Respuesta (200):**
```json
{
  "showId": 123,
  "userId": "user123",
  "position": 10,
  "estimatedWaitTime": 300,
  "queueSize": 25
}
```

### 3. Verificar Token de Acceso
```http
POST /api/queue/:showId/verify-access
Content-Type: application/json

{
  "userId": "string",
  "accessToken": "string"
}
```

**Respuesta (200):**
```json
{
  "hasAccess": true,
  "message": "Acceso verificado exitosamente"
}
```

### 4. Salir de la Cola
```http
DELETE /api/queue/:showId/leave
Content-Type: application/json

{
  "userId": "string"
}
```

### 5. Estado de la Cola
```http
GET /api/queue/:showId/status
```

**Respuesta (200):**
```json
{
  "showId": 123,
  "queueSize": 25,
  "maxSize": 1000,
  "isOpen": true
}
```

### 6. Procesar Siguiente (Admin)
```http
POST /api/queue/:showId/process-next
```

**Respuesta (200):**
```json
{
  "message": "Usuario procesado exitosamente",
  "userId": "user123",
  "showId": 123,
  "accessToken": "uuid-v4",
  "expiresAt": "2024-01-15T10:30:00.000Z"
}
```

## 🔄 Flujo de Trabajo

### Para Usuarios:

1. **Unirse a la Cola:**
   ```javascript
   const response = await fetch('/api/queue/123/join', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: 'user123',
       userInfo: { name: 'Juan Pérez', email: 'juan@email.com' }
     })
   });
   ```

2. **Monitorear Posición:**
   ```javascript
   const checkPosition = async () => {
     const response = await fetch('/api/queue/123/position?userId=user123');
     const data = await response.json();
     console.log(`Posición: ${data.position}, Tiempo estimado: ${data.estimatedWaitTime}s`);
   };
   
   // Verificar cada 10 segundos
   const interval = setInterval(checkPosition, 10000);
   ```

3. **Recibir Token de Acceso:**
   - El sistema procesará automáticamente la cola
   - El usuario recibirá un `accessToken` válido por 15 minutos

4. **Crear Orden con Token:**
   ```javascript
   const response = await fetch('/api/orders', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: 'user123',
       showId: 123,
       seats: [1, 2, 3],
       accessToken: 'received-access-token'
     })
   });
   ```

### Para Administradores:

1. **Procesar Cola Manualmente:**
   ```javascript
   const processNext = async (showId) => {
     const response = await fetch(`/api/queue/${showId}/process-next`, {
       method: 'POST'
     });
     return response.json();
   };
   ```

2. **Monitorear Estado:**
   ```javascript
   const getQueueStatus = async (showId) => {
     const response = await fetch(`/api/queue/${showId}/status`);
     return response.json();
   };
   ```

## ⚡ Integración con Sistema de Órdenes

El middleware `queueAccess` se ejecuta automáticamente en:
- `POST /api/orders` - Crear nueva orden

### Comportamiento:
- ✅ **Con accessToken válido:** Permite crear la orden
- ⚠️ **Sin accessToken:** Permite crear la orden (modo compatibilidad)
- ❌ **Con accessToken inválido:** Rechaza con error 403

## 🛠️ Mantenimiento

### Limpieza Automática:
- Las colas se limpian automáticamente cada 5 minutos
- Los usuarios inactivos por más de 15 minutos son removidos
- Los tokens de acceso expiran automáticamente

### Comandos de Diagnóstico:
```bash
# Verificar estado de Redis
curl http://localhost:3000/health

# Ver estado de cola específica
curl http://localhost:3000/api/queue/123/status
```

## 🚨 Manejo de Errores

### Errores Comunes:
- **Cola no disponible:** Redis desconectado
- **Cola llena:** Máximo de usuarios alcanzado
- **Token expirado:** Usuario debe volver a hacer cola
- **Usuario duplicado:** Ya está en una cola activa

### Modo Fail-Safe:
Si Redis no está disponible, el sistema permite crear órdenes sin restricciones de cola para mantener la funcionalidad básica.

## 📊 Métricas y Monitoreo

El endpoint `/health` incluye información sobre:
- Estado de Redis
- Circuit breaker status
- Disponibilidad del sistema de colas

```json
{
  "services": {
    "redis": {
      "status": "connected",
      "connected": true,
      "circuitBreaker": "CLOSED"
    },
    "queue": {
      "status": "enabled",
      "available": true
    }
  }
}
```
