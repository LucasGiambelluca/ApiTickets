# Actualización: Soporte de Imágenes y Venues Completos

Esta actualización agrega soporte para subir imágenes a eventos y manejo completo de venues con información de ubicación y capacidad.

## Cambios Implementados

### Backend
1. **Nueva tabla `venues`** con campos completos:
   - Información básica: nombre, dirección, ciudad, estado, país
   - Capacidad máxima de tickets
   - Coordenadas GPS (latitud/longitud)
   - Información de contacto (teléfono, email, website)
   - Descripción

2. **Tabla `events` actualizada**:
   - Campo `image_url` para URL de imagen
   - Campo `image_filename` para nombre del archivo
   - Campo `description` para descripción del evento
   - Campo `venue_id` para referenciar venue (FK)

3. **Nuevos endpoints**:
   - `GET /api/venues` - Listar venues con paginación
   - `GET /api/venues/search` - Búsqueda rápida de venues
   - `GET /api/venues/:id` - Obtener venue por ID
   - `POST /api/venues` - Crear venue
   - `PUT /api/venues/:id` - Actualizar venue
   - `DELETE /api/venues/:id` - Eliminar venue

4. **Endpoints de eventos actualizados**:
   - `POST /api/events` - Ahora soporta subida de imágenes (multipart/form-data)
   - `PUT /api/events/:id` - Actualizar evento con imagen
   - `GET /api/events/:id` - Obtener evento con información de venue
   - `DELETE /api/events/:id` - Eliminar evento y su imagen

5. **Middleware de imágenes**:
   - Procesamiento automático con Sharp (redimensión a 800x600, conversión a WebP)
   - Validación de tipos de archivo
   - Límite de 5MB por imagen
   - Almacenamiento en `/public/uploads/events/`

### Frontend
1. **Formulario de crear evento actualizado**:
   - Campo para subir imagen con preview
   - Campo de descripción
   - Selector de venue existente o creación manual

2. **Nuevo formulario de crear venue**:
   - Todos los campos de información del venue
   - Validaciones del lado cliente

3. **Visualización de eventos mejorada**:
   - Mostrar imágenes en tarjetas de eventos
   - Placeholder visual para eventos sin imagen
   - Información completa de venue

## Instrucciones de Instalación

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Ejecutar Migración de Base de Datos
```bash
npm run db:upgrade-images
```

### 3. Crear Directorio de Uploads (ya creado)
El directorio `public/uploads/events/` ya está creado y configurado.

### 4. Verificar Configuración
- El servidor ya está configurado para servir archivos estáticos desde `/public`
- Las rutas de API están configuradas correctamente
- El middleware de manejo de errores está actualizado

## Uso

### Crear un Venue
1. Ir al panel de administración
2. Hacer clic en "Crear Venue"
3. Llenar la información del venue (nombre, dirección, capacidad, etc.)
4. Guardar

### Crear un Evento con Imagen
1. Ir al panel de administración
2. Hacer clic en "Crear Evento"
3. Llenar información básica del evento
4. Subir imagen (opcional)
5. Seleccionar venue existente o escribir nombre manualmente
6. Guardar

### Venues de Ejemplo
La migración incluye 5 venues de ejemplo en Argentina:
- Teatro Colón
- Luna Park  
- Movistar Arena
- Centro Cultural Recoleta
- Estadio River Plate

## Estructura de Archivos Nuevos/Modificados

```
├── sql/
│   └── upgrade_images_venues.sql          # Nueva migración
├── middlewares/
│   └── uploadImage.js                     # Middleware para imágenes
├── controllers/
│   ├── events.controller.js               # Actualizado con imágenes
│   └── venues.controller.js               # Actualizado completamente
├── routes/
│   ├── events.routes.js                   # Actualizado con upload
│   └── venues.routes.js                   # Actualizado completamente
├── public/
│   ├── uploads/events/                    # Directorio de imágenes
│   ├── index.html                         # Formularios actualizados
│   ├── styles.css                         # Estilos para imágenes/venues
│   ├── api.js                            # API de venues agregada
│   └── app.js                            # Lógica de frontend actualizada
└── package.json                          # Dependencias agregadas
```

## Notas Técnicas

- Las imágenes se procesan automáticamente a formato WebP para optimización
- Se mantiene compatibilidad con eventos existentes (campos opcionales)
- Los venues pueden tener coordenadas GPS para futura integración con mapas
- El sistema maneja eliminación automática de imágenes huérfanas
- Validaciones robustas tanto en backend como frontend

## Próximos Pasos Sugeridos

1. Integración con mapas (Google Maps/OpenStreetMap) usando coordenadas GPS
2. Galería de imágenes múltiples por evento
3. Redimensionado automático para diferentes tamaños (thumbnails, etc.)
4. Compresión adicional de imágenes para optimización web
5. Sistema de moderación de imágenes subidas
