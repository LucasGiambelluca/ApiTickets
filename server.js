require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');

const routes = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');
const dbErrorHandler = require('./middlewares/dbErrorHandler');
const { generalLimiter } = require('./middlewares/rateLimiting');

// Inicializar Redis y tareas de limpieza
const { client: redisClient } = require('./src/redis');
const queueCleanupTask = require('./src/tasks/queueCleanup');

const app = express();

// Configuración de seguridad con Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false // Permitir embeds para MercadoPago
}));

// Rate limiting general
app.use(generalLimiter);

// Middleware para parsear JSON con límite aumentado para webhooks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configurado para producción
// Si ALLOWED_ORIGINS='*', habilitar cualquier origen reflejando el Origin del request
if (process.env.ALLOWED_ORIGINS === '*') {
  app.use(cors({
    origin: (origin, callback) => {
      // Permitir todas las origins (including undefined for same-origin tools)
      callback(null, true);
    },
    credentials: true
  }));
} else {
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
  }));
}

app.use(morgan('combined'));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Health check completo y detallado
app.get('/health', async (req, res) => {
  const { client: redisClient, isConnected } = require('./src/redis');
  const { db } = require('./src/db');
  
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: require('./package.json').version,
    services: {},
    performance: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };

  let overallHealthy = true;

  // Check Redis
  try {
    if (isConnected()) {
      await redisClient.ping();
      const redisStatus = redisClient.getStatus();
      healthStatus.services.redis = {
        status: 'connected',
        connected: redisStatus.connected,
        circuitBreaker: redisStatus.circuitBreaker
      };
    } else {
      healthStatus.services.redis = {
        status: 'disconnected',
        connected: false
      };
    }
  } catch (error) {
    healthStatus.services.redis = {
      status: 'error',
      connected: false,
      error: error.message
    };
  }

  // Check Database con timeout rápido
  try {
    // Timeout de 1 segundo para health check de DB
    const dbHealthy = await db.healthCheck(1000);
    const poolStats = db.getPoolStats();
    
    healthStatus.services.database = {
      status: dbHealthy ? 'connected' : 'error',
      healthy: dbHealthy,
      pool: poolStats
    };
    
    if (!dbHealthy) overallHealthy = false;
  } catch (error) {
    healthStatus.services.database = {
      status: 'error',
      healthy: false,
      error: error.message
    };
    overallHealthy = false;
  }

  // Queue status
  healthStatus.services.queue = {
    status: healthStatus.services.redis?.status === 'connected' ? 'enabled' : 'disabled',
    available: healthStatus.services.redis?.connected === true
  };

  // Overall status
  if (!overallHealthy) {
    healthStatus.status = 'degraded';
  }
  // Permitir que el healthcheck no rompa en entornos de dev si la DB está caída
  const allowDegraded = String(process.env.HEALTH_ALLOW_DEGRADED || '').toLowerCase() === 'true';
  const statusCode = (overallHealthy || allowDegraded) ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

app.use('/api', routes);

// Servir el frontend en la ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'NotFound' }));
app.use(dbErrorHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 3000);

// Manejo graceful de cierre
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Detener tareas de limpieza
  queueCleanupTask.stop();
  
  // Cerrar conexión Redis
  try {
    await redisClient.quit();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }
  
  process.exit(0);
}

app.listen(PORT, async () => {
  console.log(`🚀 Ticketera API running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  
  // Iniciar tareas de limpieza de cola
  queueCleanupTask.start();
  
  console.log('✅ All services initialized successfully');
});
