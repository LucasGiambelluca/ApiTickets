# 🚀 Guía de Inicio Rápido - Ticketera

## ⚡ Instalación Express (5 minutos)

### 1. **Prerrequisitos**
```bash
# Verificar versiones
node --version  # >= 16.0.0
npm --version   # >= 8.0.0
```

### 2. **Instalar Dependencias**
```bash
npm install
```

### 3. **Configurar Variables de Entorno**
```bash
# Copiar y editar .env
cp .env.example .env  # Si existe, sino usar el .env actual
```

**Configuración mínima requerida:**
```bash
# Base de datos
DB_HOST=127.0.0.1
DB_USER=app
DB_PASSWORD=app
DB_NAME=ticketera

# Redis
REDIS_HOST=127.0.0.1

# MercadoPago (usar credenciales de prueba)
MP_ACCESS_TOKEN=TEST-tu-token-de-prueba
MP_PUBLIC_KEY=TEST-tu-public-key
```

### 4. **Iniciar Servicios Externos**

#### MySQL/MariaDB
```bash
# Ubuntu/Debian
sudo systemctl start mysql

# macOS
brew services start mysql

# Windows
net start mysql
```

#### Redis
```bash
# Ubuntu/Debian
sudo systemctl start redis

# macOS
brew services start redis

# Windows/Docker
docker run -d -p 6379:6379 redis:alpine
```

### 5. **Configurar Base de Datos**
```bash
# Setup automático
npm run setup

# O manual:
npm run db:create-user
npm run db:schema
npm run db:upgrade
npm run db:seed
```

### 6. **Iniciar Aplicación**
```bash
npm start
```

**¡Listo! 🎉** 
- API: http://localhost:3000
- Health: http://localhost:3000/health

---

## 🐳 Instalación con Docker (2 minutos)

### 1. **Iniciar con Docker Compose**
```bash
docker-compose up -d
```

### 2. **Verificar Estado**
```bash
docker-compose ps
curl http://localhost:3000/health
```

**¡Listo! 🎉** Todo configurado automáticamente.

---

## 🧪 Prueba Rápida

### 1. **Crear Evento**
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concierto de Prueba",
    "startsAt": "2024-12-31T20:00:00Z"
  }'
```

### 2. **Crear Sección**
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

### 3. **Ver Asientos**
```bash
curl http://localhost:3000/api/shows/1/seats
```

### 4. **Unirse a Cola**
```bash
curl -X POST http://localhost:3000/api/queue/1/join \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "userInfo": {"name": "Usuario Prueba"}
  }'
```

### 5. **Procesar Cola**
```bash
curl -X POST http://localhost:3000/api/queue/1/process-next
```

### 6. **Crear Reserva**
```bash
curl -X POST http://localhost:3000/api/shows/1/holds \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "seats": [1, 2]
  }'
```

### 7. **Crear Orden**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "showId": 1,
    "seats": [1, 2]
  }'
```

---

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Modo desarrollo con nodemon
npm run health          # Verificar estado de la app

# Base de datos
npm run db:reset        # Recrear BD completa
npm run db:seed         # Cargar datos de prueba

# Redis
npm run redis:flush     # Limpiar Redis

# Docker
docker-compose logs -f  # Ver logs en tiempo real
docker-compose restart  # Reiniciar servicios
docker-compose down     # Detener todo
```

---

## 🚨 Solución de Problemas

### Error: "Redis connection refused"
```bash
# Verificar Redis
redis-cli ping
# Debe responder: PONG

# Si no está instalado:
# Ubuntu: sudo apt install redis-server
# macOS: brew install redis
# Windows: usar Docker
```

### Error: "Access denied for user"
```bash
# Verificar MySQL
mysql -u app -p ticketera
# Usar password del .env

# Recrear usuario:
npm run db:create-user
```

### Error: "Port 3000 already in use"
```bash
# Cambiar puerto en .env
PORT=3001

# O matar proceso:
lsof -ti:3000 | xargs kill -9
```

### Error: "Module not found"
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Próximos Pasos

1. **Configurar MercadoPago**: Ver `docs/mercadopago-setup.md`
2. **Entender la Cola**: Ver `docs/queue-system.md`
3. **Documentación completa**: Ver `README.md`
4. **Desplegar en producción**: Ver `scripts/deploy.sh`

---

## 🆘 ¿Necesitas Ayuda?

- 📖 **Documentación completa**: `README.md`
- 🐛 **Problemas comunes**: Sección troubleshooting en README
- 💳 **MercadoPago**: `docs/mercadopago-setup.md`
- 🚶‍♂️ **Cola Virtual**: `docs/queue-system.md`

**¡Disfruta construyendo con Ticketera! 🎫**
