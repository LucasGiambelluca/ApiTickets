# 🚀 GUÍA COMPLETA DE DESPLIEGUE - TICKETERA API

**Fecha:** 3 de Octubre, 2025  
**Estado:** 📋 **GUÍA PASO A PASO**  
**Objetivo:** Desplegar API en internet con alta disponibilidad

---

## 🎯 OPCIONES DE DESPLIEGUE

### 🥇 **OPCIÓN 1: RAILWAY (RECOMENDADA - FÁCIL)**
- ✅ **Gratis hasta $5/mes**
- ✅ **Deploy automático desde GitHub**
- ✅ **Base de datos MySQL incluida**
- ✅ **Redis incluido**
- ✅ **SSL automático**
- ✅ **Ideal para empezar**

### 🥈 **OPCIÓN 2: RENDER (ALTERNATIVA SÓLIDA)**
- ✅ **Tier gratuito disponible**
- ✅ **Deploy desde GitHub**
- ✅ **PostgreSQL gratuito**
- ✅ **Redis disponible**
- ✅ **SSL automático**

### 🥉 **OPCIÓN 3: VPS (MÁXIMO CONTROL)**
- ✅ **Control total**
- ✅ **Más económico a largo plazo**
- ⚠️ **Requiere más configuración**
- ⚠️ **Mantenimiento manual**

---

## 🚀 DESPLIEGUE EN RAILWAY (PASO A PASO)

### **PASO 1: Preparar el Proyecto**

#### 1.1 Crear archivo de configuración de producción
```bash
# Crear .env.production
cp .env.example .env.production
```

#### 1.2 Actualizar package.json para producción
```json
{
  "scripts": {
    "start": "node server.js",
    "build": "echo 'No build step required'",
    "deploy": "npm run db:schema && npm run db:upgrade && npm run db:indexes"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### **PASO 2: Configurar Railway**

#### 2.1 Crear cuenta en Railway
1. Ir a [railway.app](https://railway.app)
2. Registrarse con GitHub
3. Conectar repositorio

#### 2.2 Crear nuevo proyecto
```bash
# Instalar Railway CLI (opcional)
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway new
```

#### 2.3 Agregar servicios necesarios
- **MySQL Database** → Agregar desde Railway Dashboard
- **Redis** → Agregar desde Railway Dashboard
- **Node.js App** → Conectar repositorio GitHub

### **PASO 3: Configurar Variables de Entorno**

En Railway Dashboard → Variables:
```bash
# Base de datos (Railway las genera automáticamente)
DATABASE_URL=mysql://user:pass@host:port/db
MYSQL_URL=mysql://user:pass@host:port/db

# Redis (Railway lo genera automáticamente)
REDIS_URL=redis://default:pass@host:port

# Aplicación
NODE_ENV=production
PORT=3000
BASE_URL=https://tu-app.railway.app

# Seguridad (GENERAR NUEVOS SECRETOS)
JWT_SECRET=tu-jwt-secret-super-seguro-aqui
JWT_EXPIRES_IN=24h
MERCADOPAGO_WEBHOOK_SECRET=tu-webhook-secret-de-mercadopago

# CORS (ajustar según tu frontend)
ALLOWED_ORIGINS=https://tu-frontend.com,https://tu-dominio.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_STRICT_MAX=100

# MercadoPago
MP_ACCESS_TOKEN=PROD-tu-access-token-real-aqui

# Logs
LOG_LEVEL=info
LOG_MAX_FILES=7d
LOG_MAX_SIZE=50m
```

### **PASO 4: Configurar Base de Datos**

#### 4.1 Conectar a MySQL de Railway
```bash
# Railway te da estas variables automáticamente:
DB_HOST=containers-us-west-xxx.railway.app
DB_PORT=6543
DB_USER=root
DB_PASSWORD=xxx
DB_NAME=railway
```

#### 4.2 Ejecutar migraciones
```bash
# En Railway, agregar comando de deploy
npm run deploy
```

### **PASO 5: Desplegar**

#### 5.1 Push a GitHub
```bash
git add .
git commit -m "Preparar para producción"
git push origin main
```

#### 5.2 En Railway Dashboard
1. **Connect Repository** → Seleccionar tu repo
2. **Deploy** → Railway despliega automáticamente
3. **Verificar logs** → Ver que todo funcione

#### 5.3 Configurar dominio personalizado (opcional)
1. Railway Dashboard → Settings → Domains
2. Agregar tu dominio personalizado
3. Configurar DNS según instrucciones

---

## 🔧 DESPLIEGUE EN RENDER

### **PASO 1: Preparar Proyecto**
```bash
# Ejecutar configuración automática
npm run deploy:setup
```

### **PASO 2: Crear Servicios en Render**

#### 2.1 Base de Datos PostgreSQL
1. Render Dashboard → New → PostgreSQL
2. Nombre: `ticketera-db`
3. Plan: Free
4. Crear y obtener `DATABASE_URL`

#### 2.2 Redis
1. Render Dashboard → New → Redis
2. Nombre: `ticketera-redis`
3. Plan: Free
4. Obtener `REDIS_URL`

#### 2.3 Web Service
1. Render Dashboard → New → Web Service
2. Conectar GitHub repository
3. Configurar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** `Node`

### **PASO 3: Variables de Entorno en Render**
```bash
# En Render Dashboard → Environment
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host/db
REDIS_URL=redis://host:port
JWT_SECRET=tu-jwt-secret-aqui
MERCADOPAGO_WEBHOOK_SECRET=tu-webhook-secret
MP_ACCESS_TOKEN=PROD-tu-token-real
BASE_URL=https://tu-app.onrender.com
ALLOWED_ORIGINS=https://tu-frontend.com
```

---

## 🖥️ DESPLIEGUE EN VPS (AVANZADO)

### **PASO 1: Configurar Servidor**

#### 1.1 Conectar al VPS
```bash
ssh root@tu-servidor-ip
```

#### 1.2 Instalar dependencias
```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Instalar PM2 (Process Manager)
npm install -g pm2

# Instalar Nginx
apt install nginx -y

# Instalar MySQL
apt install mysql-server -y

# Instalar Redis
apt install redis-server -y
```

### **PASO 2: Configurar Base de Datos**
```bash
# Configurar MySQL
mysql_secure_installation

# Crear base de datos
mysql -u root -p
CREATE DATABASE ticketera;
CREATE USER 'ticketera'@'localhost' IDENTIFIED BY 'password-seguro';
GRANT ALL PRIVILEGES ON ticketera.* TO 'ticketera'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### **PASO 3: Desplegar Aplicación**
```bash
# Clonar repositorio
cd /var/www
git clone https://github.com/tu-usuario/ticketera.git
cd ticketera

# Instalar dependencias
npm install --production

# Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con valores reales

# Inicializar base de datos
npm run deploy:init-db

# Iniciar con PM2
pm2 start server.js --name "ticketera-api"
pm2 save
pm2 startup
```

### **PASO 4: Configurar Nginx**
```nginx
# /etc/nginx/sites-available/ticketera
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Habilitar sitio
ln -s /etc/nginx/sites-available/ticketera /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Configurar SSL con Certbot
apt install certbot python3-certbot-nginx -y
certbot --nginx -d tu-dominio.com
```

---

## 🛠️ CONFIGURACIÓN AUTOMÁTICA

### **Ejecutar Configuración Completa**
```bash
# 1. Preparar para producción
npm run deploy:setup

# 2. Instalar seguridad
npm run security:install

# 3. Verificar configuración
npm run health
```

---

## 📊 MONITOREO EN PRODUCCIÓN

### **Logs y Métricas**
```bash
# Ver logs en tiempo real
npm run logs

# Ver logs de errores
npm run logs:error

# Health check
curl https://tu-dominio.com/health

# Métricas de seguridad
tail -f logs/security-*.log
```

### **Alertas Recomendadas**
- ✅ **Uptime monitoring** (UptimeRobot, Pingdom)
- ✅ **Error tracking** (Sentry)
- ✅ **Performance monitoring** (New Relic)
- ✅ **Log aggregation** (LogDNA, Papertrail)

---

## 🔒 CONFIGURACIÓN DE MERCADOPAGO

### **Webhook en Producción**
1. **Panel MercadoPago** → Webhooks
2. **URL:** `https://tu-dominio.com/api/payments/webhook`
3. **Eventos:** `payment`, `merchant_order`
4. **Secret:** Usar `MERCADOPAGO_WEBHOOK_SECRET`

### **Testing de Webhooks**
```bash
# Verificar webhook
curl -X POST https://tu-dominio.com/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=1234567890,v1=hash-aqui" \
  -d '{"type":"payment","data":{"id":"123"}}'
```

---

## ✅ CHECKLIST DE PRODUCCIÓN

### **Pre-Deploy**
- [ ] Variables de entorno configuradas
- [ ] Secretos de seguridad generados
- [ ] Base de datos configurada
- [ ] Redis configurado
- [ ] SSL/HTTPS habilitado
- [ ] Dominio configurado

### **Post-Deploy**
- [ ] Health check responde OK
- [ ] Webhooks de MercadoPago funcionan
- [ ] Rate limiting activo
- [ ] Logs de seguridad funcionando
- [ ] Monitoreo configurado
- [ ] Backup de BD configurado

---

## 🚨 TROUBLESHOOTING

### **Problemas Comunes**

#### Base de Datos no Conecta
```bash
# Verificar variables
echo $DATABASE_URL

# Test de conexión
npm run health
```

#### Redis no Disponible
```bash
# Verificar Redis
redis-cli ping

# Logs de Redis
tail -f /var/log/redis/redis-server.log
```

#### Rate Limiting muy Estricto
```bash
# Ajustar en variables de entorno
RATE_LIMIT_MAX_REQUESTS=2000
RATE_LIMIT_STRICT_MAX=500
```

---

## 📞 SOPORTE

### **Recursos Útiles**
- 📚 **Railway Docs:** https://docs.railway.app
- 📚 **Render Docs:** https://render.com/docs
- 📚 **MercadoPago Docs:** https://www.mercadopago.com.ar/developers

### **Contacto**
- **Desarrollador:** Backend Full Stack Senior
- **Documentación:** `docs/SECURITY_IMPLEMENTATION.md`
- **Scripts:** `scripts/` directory

---

**🚀 ¡Tu API Ticketera está lista para conquistar internet!** 🎫✨

<function_calls>
<invoke name="Read">
<parameter name="file_path">c:\Users\Lucas\Desktop\Ticketera\src\db.js
