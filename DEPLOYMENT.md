# 🚀 Guía de Despliegue Optimizada - Ticketera

## ⚡ Despliegue Express (Recomendado)

### 🐳 **Opción 1: Docker Compose (Más Eficiente)**

```bash
# 1. Clonar y configurar
git clone <repo>
cd ticketera

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Desplegar todo con un comando
npm run docker:up

# 4. Verificar estado
npm run health
```

**¡Listo en 2 minutos! 🎉**

---

## 🏗️ **Arquitectura Optimizada**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │   Ticketera     │    │     Redis       │
│  Load Balancer  │◄──►│   (Node.js)     │◄──►│  Queue + Cache  │
│  Rate Limiting  │    │                 │    │  Optimized      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SSL/HTTPS     │    │   MySQL Pool    │    │   Monitoring    │
│   Compression   │    │   20 Conexiones │    │   Health Checks │
│   Caching       │    │   Optimizado    │    │   Circuit Break │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ⚙️ **Configuraciones de Alto Rendimiento**

### **Redis Optimizado**
- ✅ **4 IO Threads** para máxima concurrencia
- ✅ **256MB Memory** con LRU eviction
- ✅ **AOF + RDB** persistencia híbrida
- ✅ **Lazy freeing** para mejor performance
- ✅ **Pipeline optimizations**

### **MySQL Optimizado**
- ✅ **InnoDB Buffer Pool 256MB**
- ✅ **20 Conexiones simultáneas**
- ✅ **Query cache deshabilitado** (mejor para writes)
- ✅ **Binlog optimizado** para replicación
- ✅ **Índices estratégicos** para queries críticas

### **Node.js Optimizado**
- ✅ **2GB Heap máximo**
- ✅ **Garbage collection optimizado**
- ✅ **Circuit breakers** para servicios externos
- ✅ **Retry logic** con backoff exponencial
- ✅ **Connection pooling** avanzado

---

## 🚀 **Comandos de Despliegue**

### **Desarrollo Local**
```bash
npm run dev              # Desarrollo con hot reload
npm run health          # Verificar estado
npm run logs            # Ver logs en tiempo real
```

### **Producción Optimizada**
```bash
npm run start:prod      # Inicio optimizado con logging
npm run docker:up       # Docker con todas las optimizaciones
npm run deploy          # Deploy automatizado completo
```

### **Mantenimiento**
```bash
npm run db:optimize     # Aplicar índices de performance
npm run redis:flush     # Limpiar cache Redis
npm run docker:logs     # Ver logs de todos los servicios
```

---

## 📊 **Monitoreo y Performance**

### **Health Check Avanzado**
```bash
curl http://localhost:3000/health
```

**Respuesta detallada:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "redis": {
      "status": "connected",
      "circuitBreaker": {
        "state": "CLOSED",
        "failureCount": 0
      }
    },
    "database": {
      "status": "connected",
      "pool": {
        "totalConnections": 5,
        "freeConnections": 3,
        "connectionLimit": 20
      }
    },
    "queue": {
      "status": "enabled",
      "available": true
    }
  },
  "performance": {
    "memory": {
      "rss": 45678592,
      "heapUsed": 23456789
    }
  }
}
```

### **Métricas Clave**
- 🎯 **Latencia API**: < 100ms promedio
- 🎯 **Throughput**: > 1000 req/min
- 🎯 **Uptime**: > 99.9%
- 🎯 **Memory Usage**: < 512MB
- 🎯 **DB Connections**: < 15 activas

---

## 🔧 **Configuración por Ambiente**

### **Desarrollo**
```bash
NODE_ENV=development
DB_HOST=localhost
REDIS_HOST=localhost
QUEUE_MAX_SIZE=100
```

### **Staging**
```bash
NODE_ENV=staging
DB_HOST=staging-db.internal
REDIS_HOST=staging-redis.internal
QUEUE_MAX_SIZE=500
```

### **Producción**
```bash
NODE_ENV=production
DB_HOST=prod-db.internal
REDIS_HOST=prod-redis.internal
QUEUE_MAX_SIZE=1000
DB_SSL=true
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## 🛡️ **Seguridad y Robustez**

### **Circuit Breakers Implementados**
- ✅ **Redis**: 3 fallos → OPEN por 30s
- ✅ **Database**: 5 fallos → OPEN por 60s
- ✅ **MercadoPago**: 3 fallos → OPEN por 2min

### **Retry Logic**
- ✅ **Exponential backoff** con jitter
- ✅ **Max 3 reintentos** para operaciones críticas
- ✅ **Smart error detection** (retryable vs non-retryable)

### **Rate Limiting (Nginx)**
- ✅ **API General**: 10 req/s por IP
- ✅ **Webhooks**: 5 req/s por IP
- ✅ **Burst handling**: 20 requests buffer

---

## 🚨 **Troubleshooting Avanzado**

### **Redis Issues**
```bash
# Verificar conexión
docker exec ticketera_redis redis-cli ping

# Ver memoria usage
docker exec ticketera_redis redis-cli info memory

# Monitorear comandos
docker exec ticketera_redis redis-cli monitor
```

### **MySQL Issues**
```bash
# Verificar conexiones
docker exec ticketera_mysql mysql -u app -p -e "SHOW PROCESSLIST;"

# Ver performance
docker exec ticketera_mysql mysql -u app -p -e "SHOW ENGINE INNODB STATUS\G"

# Verificar índices
docker exec ticketera_mysql mysql -u app -p ticketera -e "SHOW INDEX FROM seats;"
```

### **Application Issues**
```bash
# Ver logs detallados
npm run logs

# Ver solo errores
npm run logs:error

# Health check detallado
curl -s http://localhost:3000/health | jq .
```

---

## 📈 **Scaling y Optimización**

### **Horizontal Scaling**
```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  app:
    deploy:
      replicas: 3
    
  nginx:
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
```

### **Database Scaling**
```sql
-- Read replicas
CREATE USER 'readonly'@'%' IDENTIFIED BY 'readonly_password';
GRANT SELECT ON ticketera.* TO 'readonly'@'%';

-- Partitioning para tablas grandes
ALTER TABLE orders PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026)
);
```

### **Redis Scaling**
```bash
# Redis Cluster (para alta disponibilidad)
redis-cli --cluster create \
  redis1:6379 redis2:6379 redis3:6379 \
  --cluster-replicas 1
```

---

## 🎯 **Benchmarks y Performance**

### **Load Testing**
```bash
# Instalar herramientas
npm install -g artillery

# Test básico
artillery quick --count 100 --num 10 http://localhost:3000/health

# Test completo
artillery run tests/load-test.yml
```

### **Performance Esperado**
| Métrica | Desarrollo | Producción |
|---------|------------|------------|
| Latencia P95 | < 200ms | < 100ms |
| Throughput | 500 req/min | 2000 req/min |
| Memory | < 256MB | < 512MB |
| CPU | < 50% | < 70% |

---

## ✅ **Checklist de Despliegue**

### **Pre-Despliegue**
- [ ] Variables de entorno configuradas
- [ ] Credenciales de MercadoPago válidas
- [ ] Base de datos accesible
- [ ] Redis disponible
- [ ] SSL certificados (producción)

### **Post-Despliegue**
- [ ] Health check retorna 200
- [ ] Logs sin errores críticos
- [ ] Métricas dentro de rangos esperados
- [ ] Webhooks de MercadoPago funcionando
- [ ] Cola virtual operativa

### **Verificación Final**
```bash
# Test completo del flujo
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Event", "startsAt": "2024-12-31T20:00:00Z"}'

# Verificar cola
curl -X POST http://localhost:3000/api/queue/1/join \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "userInfo": {"name": "Test User"}}'

# Health check final
curl http://localhost:3000/health | jq .status
```

---

## 🆘 **Soporte y Contacto**

- 📖 **Documentación**: `README.md`
- 🐛 **Issues**: GitHub Issues
- 📊 **Monitoring**: Logs en `logs/` directory
- 🔍 **Debug**: `npm run logs` para tiempo real

**¡Ticketera optimizada y lista para producción! 🎫**
