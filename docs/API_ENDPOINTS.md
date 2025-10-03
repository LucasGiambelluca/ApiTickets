# Documentación de API Endpoints - Ticketera

## Base URL
```
http://localhost:3000/api
```

## Autenticación
Actualmente la API no requiere autenticación. Todos los endpoints son públicos.

---

## 📅 EVENTOS

### GET /api/events
Lista eventos con paginación, filtros y búsqueda.

**Query Parameters:**
```javascript
{
  page?: number = 1,           // Página actual
  limit?: number = 20,         // Elementos por página
  search?: string = '',        // Búsqueda por nombre
  status?: 'active' | 'all' = 'active',  // Filtro de estado
  sortBy?: 'name' | 'created_at' | 'id' = 'created_at',
  sortOrder?: 'ASC' | 'DESC' = 'DESC'
}
```

**Response:**
```javascript
{
  "events": [
    {
      "id": 1,
      "name": "Concierto de Rock",
      "organizer_id": null,
      "venue": "Luna Park",           // Venue como texto (legacy)
      "image_url": "/uploads/events/abc123.webp",
      "image_filename": "abc123.webp",
      "description": "Un gran concierto de rock",
      "venue_id": 2,
      "venue_name": "Luna Park",      // Nombre del venue desde tabla venues
      "venue_city": "Buenos Aires",   // Ciudad del venue
      "venue_capacity": 8500,         // Capacidad máxima del venue
      "created_at": "2024-01-15T10:30:00.000Z",
      "show_count": 3,               // Cantidad de shows
      "next_show_date": "2024-02-15T20:00:00.000Z",
      "last_show_date": "2024-02-17T20:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### GET /api/events/search
Búsqueda rápida de eventos (para autocomplete).

**Query Parameters:**
```javascript
{
  q: string,        // Query de búsqueda (mínimo 2 caracteres)
  limit?: number = 10
}
```

**Response:**
```javascript
{
  "events": [
    {
      "id": 1,
      "name": "Concierto de Rock",
      "image_url": "/uploads/events/abc123.webp",
      "venue_name": "Luna Park",
      "venue_city": "Buenos Aires",
      "show_count": 3,
      "next_show_date": "2024-02-15T20:00:00.000Z"
    }
  ]
}
```

### GET /api/events/:id
Obtiene un evento específico con información completa.

**Response:**
```javascript
{
  "id": 1,
  "name": "Concierto de Rock",
  "organizer_id": null,
  "venue": "Luna Park",
  "image_url": "/uploads/events/abc123.webp",
  "image_filename": "abc123.webp",
  "description": "Un gran concierto de rock",
  "venue_id": 2,
  "created_at": "2024-01-15T10:30:00.000Z",
  "venue_name": "Luna Park",
  "venue_address": "Av. Eduardo Madero 470",
  "venue_city": "Buenos Aires",
  "venue_capacity": 8500,
  "shows": [
    {
      "id": 1,
      "starts_at": "2024-02-15T20:00:00.000Z",
      "status": "PUBLISHED",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### POST /api/events
Crea un nuevo evento con show. Soporta subida de imagen.

**Content-Type:** `multipart/form-data`

**Body (FormData):**
```javascript
{
  name: string,              // Requerido
  startsAt: string,          // Requerido (ISO 8601 datetime)
  description?: string,      // Opcional
  venue?: string,           // Opcional (nombre manual del venue)
  venue_id?: number,        // Opcional (ID de venue existente)
  image?: File              // Opcional (archivo de imagen)
}
```

**Response:**
```javascript
{
  "eventId": 1,
  "showId": 1,
  "name": "Concierto de Rock",
  "venue": "Luna Park",
  "venue_id": 2,
  "description": "Un gran concierto",
  "image_url": "/uploads/events/abc123.webp",
  "startsAt": "2024-02-15T20:00:00.000Z"
}
```

### PUT /api/events/:id
Actualiza un evento existente. Soporta actualización de imagen.

**Content-Type:** `multipart/form-data`

**Body (FormData):**
```javascript
{
  name?: string,
  description?: string,
  venue?: string,
  venue_id?: number,
  image?: File              // Nueva imagen (reemplaza la anterior)
}
```

**Response:**
```javascript
{
  "id": 1,
  "name": "Concierto de Rock Actualizado",
  "venue": "Luna Park",
  "venue_id": 2,
  "description": "Descripción actualizada",
  "image_url": "/uploads/events/new123.webp",
  "venue_name": "Luna Park",
  "venue_city": "Buenos Aires",
  // ... otros campos
}
```

### DELETE /api/events/:id
Elimina un evento y todos sus shows asociados. También elimina la imagen si existe.

**Response:**
```javascript
{
  "message": "Evento eliminado correctamente"
}
```

---

## 🏢 VENUES

### GET /api/venues
Lista venues con paginación, filtros y búsqueda.

**Query Parameters:**
```javascript
{
  page?: number = 1,
  limit?: number = 20,
  search?: string = '',        // Búsqueda por nombre
  city?: string = '',          // Filtro por ciudad
  sortBy?: 'name' | 'city' | 'max_capacity' | 'created_at' = 'name',
  sortOrder?: 'ASC' | 'DESC' = 'ASC'
}
```

**Response:**
```javascript
{
  "venues": [
    {
      "id": 1,
      "name": "Teatro Colón",
      "address": "Cerrito 628",
      "city": "Buenos Aires",
      "state": "CABA",
      "country": "Argentina",
      "postal_code": "C1010AAH",
      "latitude": -34.6009,
      "longitude": -58.3831,
      "max_capacity": 2487,
      "description": "Uno de los teatros de ópera más importantes del mundo",
      "phone": "+54 11 4378-7100",
      "email": "info@teatrocolon.org.ar",
      "website": "https://www.teatrocolon.org.ar",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

### GET /api/venues/search
Búsqueda rápida de venues (para autocomplete).

**Query Parameters:**
```javascript
{
  q: string,        // Query de búsqueda (mínimo 2 caracteres)
  limit?: number = 10
}
```

**Response:**
```javascript
{
  "venues": [
    {
      "id": 1,
      "name": "Teatro Colón",
      "city": "Buenos Aires",
      "max_capacity": 2487,
      "address": "Cerrito 628"
    }
  ]
}
```

### GET /api/venues/:id
Obtiene un venue específico por ID.

**Response:**
```javascript
{
  "id": 1,
  "name": "Teatro Colón",
  "address": "Cerrito 628",
  "city": "Buenos Aires",
  "state": "CABA",
  "country": "Argentina",
  "postal_code": "C1010AAH",
  "latitude": -34.6009,
  "longitude": -58.3831,
  "max_capacity": 2487,
  "description": "Uno de los teatros de ópera más importantes del mundo",
  "phone": "+54 11 4378-7100",
  "email": "info@teatrocolon.org.ar",
  "website": "https://www.teatrocolon.org.ar",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### POST /api/venues
Crea un nuevo venue.

**Content-Type:** `application/json`

**Body:**
```javascript
{
  name: string,              // Requerido
  address: string,           // Requerido
  city: string,              // Requerido
  max_capacity: number,      // Requerido (> 0)
  state?: string,
  country?: string = "Argentina",
  postal_code?: string,
  latitude?: number,         // Coordenada GPS
  longitude?: number,        // Coordenada GPS
  description?: string,
  phone?: string,
  email?: string,
  website?: string
}
```

**Response:**
```javascript
{
  "id": 6,
  "name": "Nuevo Venue",
  "address": "Av. Corrientes 1234",
  "city": "Buenos Aires",
  "state": "CABA",
  "country": "Argentina",
  "postal_code": null,
  "latitude": null,
  "longitude": null,
  "max_capacity": 1000,
  "description": null,
  "phone": null,
  "email": null,
  "website": null
}
```

### PUT /api/venues/:id
Actualiza un venue existente.

**Content-Type:** `application/json`

**Body:** (todos los campos son opcionales)
```javascript
{
  name?: string,
  address?: string,
  city?: string,
  state?: string,
  country?: string,
  postal_code?: string,
  latitude?: number,
  longitude?: number,
  max_capacity?: number,     // Debe ser > 0
  description?: string,
  phone?: string,
  email?: string,
  website?: string
}
```

**Response:**
```javascript
{
  "id": 1,
  "name": "Teatro Colón Actualizado",
  // ... todos los campos actualizados
}
```

### DELETE /api/venues/:id
Elimina un venue. Falla si tiene eventos asociados.

**Response:**
```javascript
{
  "message": "Venue eliminado correctamente"
}
```

**Error si tiene eventos asociados:**
```javascript
{
  "error": "No se puede eliminar el venue porque tiene eventos asociados"
}
```

---

## ⚙️ ADMINISTRACIÓN

### GET /api/admin/settings/mercadopago
Obtiene la configuración actual de MercadoPago.

**Response:**
```javascript
{
  "configured": true,
  "environment": "TEST",      // "TEST" o "PROD"
  "accessToken": "TEST-123***456",  // Token enmascarado
  "publicKey": "TEST-abc***def",
  "collectorId": "123456789"
}
```

### PUT /api/admin/settings/mercadopago
Configura las credenciales de MercadoPago.

**Content-Type:** `application/json`

**Body:**
```javascript
{
  accessToken: string,       // Requerido (TEST-... o APP_USR-...)
  publicKey: string,         // Requerido (TEST-... o APP_USR-...)
  collectorId?: string       // Opcional
}
```

**Response:**
```javascript
{
  "message": "Configuración de MercadoPago guardada exitosamente",
  "environment": "TEST"
}
```

### POST /api/admin/settings/mercadopago/test
Prueba la conexión con MercadoPago usando las credenciales configuradas.

**Response (éxito):**
```javascript
{
  "success": true,
  "message": "Conexión exitosa con MercadoPago",
  "environment": "TEST",
  "userId": "123456789"
}
```

**Response (error):**
```javascript
{
  "success": false,
  "message": "Error de conexión: Invalid access token",
  "environment": "TEST"
}
```

### GET /api/admin/settings/fixed-fee
Obtiene la tarifa fija configurada.

**Response:**
```javascript
{
  "fixedFeeCents": 5000      // Tarifa en centavos
}
```

### PUT /api/admin/settings/fixed-fee
Configura la tarifa fija.

**Content-Type:** `application/json`

**Body:**
```javascript
{
  fixedFeeCents: number      // Requerido (>= 0)
}
```

**Response:**
```javascript
{
  "message": "Tarifa fija actualizada exitosamente",
  "fixedFeeCents": 5000
}
```

---

## 🏥 HEALTH CHECK

### GET /health
Verifica el estado de salud de la aplicación y sus servicios.

**Response:**
```javascript
{
  "status": "ok",           // "ok" | "degraded"
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,         // Segundos de uptime
  "version": "1.0.0",
  "services": {
    "redis": {
      "status": "connected",
      "connected": true,
      "circuitBreaker": {
        "state": "closed",
        "failures": 0
      }
    },
    "database": {
      "status": "connected",
      "healthy": true,
      "pool": {
        "totalConnections": 10,
        "idleConnections": 8,
        "queuedRequests": 0
      }
    },
    "queue": {
      "status": "enabled",
      "available": true
    }
  },
  "performance": {
    "memory": {
      "rss": 45678912,
      "heapTotal": 23456789,
      "heapUsed": 12345678,
      "external": 1234567
    },
    "cpu": {
      "user": 123456,
      "system": 78901
    }
  }
}
```

---

## 🚨 MANEJO DE ERRORES

Todos los endpoints pueden devolver los siguientes errores:

### 400 Bad Request
```javascript
{
  "error": "Faltan campos requeridos: name, address, city, max_capacity"
}
```

### 404 Not Found
```javascript
{
  "error": "Evento no encontrado"
}
```

### 500 Internal Server Error
```javascript
{
  "error": "Error interno del servidor"
}
```

---

## 📝 NOTAS PARA REACT

### Subida de Archivos
Para subir imágenes desde React, usar FormData:

```javascript
const formData = new FormData();
formData.append('name', 'Mi Evento');
formData.append('startsAt', '2024-02-15T20:00:00.000Z');
formData.append('image', fileInput.files[0]);

fetch('/api/events', {
  method: 'POST',
  body: formData  // NO agregar Content-Type header
});
```

### Imágenes
- Las URLs de imágenes son relativas: `/uploads/events/filename.webp`
- URL completa: `http://localhost:3000/uploads/events/filename.webp`
- Formatos soportados: JPG, PNG, GIF, WebP
- Tamaño máximo: 5MB
- Se procesan automáticamente a 800x600 en formato WebP

### Paginación
- Usar `page` y `limit` para controlar paginación
- La respuesta incluye información completa de paginación
- `totalPages` indica cuántas páginas hay en total

### Filtros y Búsqueda
- `search` busca en el nombre de eventos/venues
- `status: 'active'` solo muestra eventos con shows futuros
- `status: 'all'` muestra todos los eventos
- Ordenamiento configurable con `sortBy` y `sortOrder`
