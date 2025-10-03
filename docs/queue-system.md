# 🚶‍♂️ Sistema de Cola Virtual

## Descripción

El sistema de cola virtual permite controlar el acceso a la compra de tickets durante períodos de alta demanda, evitando la sobrecarga del servidor y mejorando la experiencia del usuario.

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │    │   Ticketera     │    │     Redis       │
│                 │    │      API        │    │                 │
│  - Queue UI     │◄──►│  - Queue API    │◄──►│  - Queue Data   │
│  - Position     │    │  - Access       │    │  - Sessions     │
│  - Waiting      │    │  - Validation   │    │  - Cleanup      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔄 Flujo de Usuario

### 1. **Unirse a la Cola**
```javascript
// Usuario se une a la cola
POST /api/queue/:showId/join
{
  "userId": "user123",
  "userInfo": {
    "name": "Juan Pérez",
    "email": "juan@example.com"
  }
}

// Respuesta
{
  "success": true,
  "position": 15,
  "sessionId": "uuid-session-id",
  "estimatedWaitTime": 450, // segundos
  "queueSize": 100
}
```

### 2. **Monitorear Posición**
```javascript
// Verificar posición cada 30 segundos
GET /api/queue/:showId/position?userId=user123

// Respuesta
{
  "showId": 1,
  "userId": "user123", 
  "position": 12,
  "estimatedWaitTime": 360,
  "queueSize": 98
}
```

### 3. **Obtener Acceso**
```javascript
// Admin procesa siguiente en cola
POST /api/queue/:showId/process-next

// Respuesta
{
  "userId": "user123",
  "showId": 1,
  "accessToken": "access-token-uuid",
  "expiresAt": "2024-01-01T20:15:00Z"
}
```

### 4. **Usar Token de Acceso**
```javascript
// Crear orden con token de acceso
POST /api/orders
{
  "userId": "user123",
  "showId": 1,
  "seats": [1, 2],
  "accessToken": "access-token-uuid"
}
```

## 📊 Estados de la Cola

### Estados del Usuario
- **No en cola**: Usuario no está en ninguna cola
- **En espera**: Usuario está en la cola esperando
- **Con acceso**: Usuario tiene token de acceso válido
- **Expirado**: Token de acceso expirado

### Estados de la Cola
- **Abierta**: Acepta nuevos usuarios
- **Llena**: Ha alcanzado el límite máximo
- **Cerrada**: No acepta nuevos usuarios

## ⚙️ Configuración

### Variables de Entorno
```bash
# Tamaño máximo de cola por show
QUEUE_MAX_SIZE=1000

# Tiempo de expiración en cola (minutos)
QUEUE_TIMEOUT_MINUTES=15

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### Estructura de Datos en Redis

#### Cola de Show
```
Key: queue:show:1
Type: LIST
Value: [
  '{"userId":"user1","showId":1,"joinedAt":"2024-01-01T20:00:00Z","sessionId":"uuid1"}',
  '{"userId":"user2","showId":1,"joinedAt":"2024-01-01T20:00:30Z","sessionId":"uuid2"}'
]
```

#### Usuario en Cola
```
Key: user:queue:user123
Type: STRING
Value: "1" (showId)
TTL: 900 seconds (15 minutos)
```

#### Token de Acceso
```
Key: access:1:user123
Type: STRING  
Value: "access-token-uuid"
TTL: 900 seconds (15 minutos)
```

## 🔧 API Endpoints

### Unirse a Cola
```http
POST /api/queue/:showId/join
Content-Type: application/json

{
  "userId": "string (required)",
  "userInfo": {
    "name": "string (optional)",
    "email": "string (optional)"
  }
}
```

**Respuestas:**
- `201`: Usuario agregado exitosamente
- `409`: Usuario ya está en una cola
- `503`: Cola llena

### Verificar Posición
```http
GET /api/queue/:showId/position?userId=user123
```

**Respuestas:**
- `200`: Posición encontrada
- `404`: Usuario no está en la cola

### Procesar Siguiente (Admin)
```http
POST /api/queue/:showId/process-next
```

**Respuestas:**
- `200`: Usuario procesado
- `404`: Cola vacía

### Verificar Acceso
```http
POST /api/queue/:showId/verify-access
Content-Type: application/json

{
  "userId": "string",
  "accessToken": "string"
}
```

**Respuestas:**
- `200`: Acceso válido
- `403`: Token inválido o expirado

### Salir de Cola
```http
DELETE /api/queue/:showId/leave
Content-Type: application/json

{
  "userId": "string"
}
```

### Estado de Cola
```http
GET /api/queue/:showId/status
```

**Respuesta:**
```json
{
  "showId": 1,
  "queueSize": 50,
  "maxSize": 1000,
  "isOpen": true
}
```

## 🎨 Frontend Integration

### React Hook Ejemplo
```javascript
import { useState, useEffect } from 'react';

function useQueue(showId, userId) {
  const [queueState, setQueueState] = useState({
    inQueue: false,
    position: null,
    accessToken: null,
    loading: false
  });

  const joinQueue = async (userInfo) => {
    setQueueState(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch(`/api/queue/${showId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userInfo })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setQueueState({
          inQueue: true,
          position: data.position,
          accessToken: null,
          loading: false
        });
        
        // Iniciar polling de posición
        startPositionPolling();
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      setQueueState(prev => ({ ...prev, loading: false }));
    }
  };

  const startPositionPolling = () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/queue/${showId}/position?userId=${userId}`);
        const data = await response.json();
        
        if (response.ok) {
          setQueueState(prev => ({
            ...prev,
            position: data.position
          }));
          
          // Si llegó al frente, obtener token de acceso
          if (data.position === 1) {
            // Lógica para obtener token de acceso
            clearInterval(interval);
          }
        } else {
          // Usuario ya no está en cola
          clearInterval(interval);
          setQueueState({
            inQueue: false,
            position: null,
            accessToken: null,
            loading: false
          });
        }
      } catch (error) {
        console.error('Error checking position:', error);
      }
    }, 30000); // Cada 30 segundos
  };

  return { queueState, joinQueue };
}
```

### Componente de Cola
```javascript
function QueueComponent({ showId, userId }) {
  const { queueState, joinQueue } = useQueue(showId, userId);

  if (queueState.loading) {
    return <div>Uniéndose a la cola...</div>;
  }

  if (!queueState.inQueue) {
    return (
      <button onClick={() => joinQueue({ name: 'Usuario' })}>
        Unirse a la Cola
      </button>
    );
  }

  return (
    <div className="queue-status">
      <h3>En Cola</h3>
      <p>Posición: {queueState.position}</p>
      <p>Tiempo estimado: {queueState.position * 30} segundos</p>
      <div className="progress-bar">
        {/* Barra de progreso */}
      </div>
    </div>
  );
}
```

## 🧹 Limpieza Automática

### Tarea de Limpieza
El sistema ejecuta automáticamente una tarea cada 5 minutos que:

1. **Remueve usuarios expirados** (más de 15 minutos en cola)
2. **Limpia tokens de acceso expirados**
3. **Actualiza métricas de cola**

### Configuración Manual
```javascript
// Limpiar colas manualmente
const queueService = require('./src/services/queueService');
await queueService.cleanExpiredQueues();

// Limpiar Redis completamente (desarrollo)
npm run redis:flush
```

## 📈 Monitoreo y Métricas

### Métricas Importantes
- **Tamaño de cola por show**
- **Tiempo promedio de espera**
- **Tasa de abandono**
- **Usuarios procesados por minuto**

### Logs
```javascript
// Eventos importantes que se loguean
- Usuario se une a cola
- Usuario sale de cola  
- Usuario obtiene acceso
- Token de acceso expira
- Limpieza de cola ejecutada
```

### Dashboard Redis
```bash
# Monitorear Redis
redis-cli monitor

# Ver todas las colas activas
redis-cli keys "queue:show:*"

# Ver usuarios en cola específica
redis-cli lrange "queue:show:1" 0 -1
```

## 🚨 Manejo de Errores

### Errores Comunes
- **Usuario ya en cola**: 409 Conflict
- **Cola llena**: 503 Service Unavailable  
- **Token expirado**: 403 Forbidden
- **Redis desconectado**: 500 Internal Server Error

### Recuperación
- **Reconexión automática** a Redis
- **Persistencia de estado** en base de datos (opcional)
- **Fallback sin cola** en caso de falla crítica

## 🔒 Seguridad

### Validaciones
- ✅ Un usuario por cola máximo
- ✅ Tokens de acceso con TTL
- ✅ Validación de showId existente
- ✅ Rate limiting en endpoints

### Prevención de Abuso
- **Límite por IP**: Máximo 5 usuarios por IP
- **Validación de email**: Prevenir cuentas fake
- **Captcha**: En frontend para unirse a cola
- **Monitoreo**: Detectar patrones sospechosos
