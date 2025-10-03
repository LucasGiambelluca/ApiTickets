const queueService = require('../src/services/queueService');
const { client: redisClient, isConnected } = require('../src/redis');
const crypto = require('crypto');

// Middleware para verificar acceso de cola con seguridad mejorada
module.exports = async function queueAccessMiddleware(req, res, next) {
  try {
    const { showId, userId, accessToken } = req.body;
    const userAgent = req.get('user-agent');
    const clientIP = req.ip;
    
    // Si no se proporciona token de acceso, verificar si es requerido
    if (!accessToken) {
      // Verificar si el show requiere cola
      const queueRequired = await isQueueRequired(showId);
      if (queueRequired) {
        return res.status(403).json({
          error: 'QueueAccessRequired',
          message: 'Este evento requiere acceso a través de la cola virtual'
        });
      }
      return next();
    }

    // Verificar token con binding de seguridad
    const tokenValid = await verifySecureToken(accessToken, {
      showId,
      userId,
      userAgent,
      clientIP
    });

    if (!tokenValid) {
      // Log intento de acceso sospechoso
      console.warn('Token de cola inválido o comprometido:', {
        showId,
        userId,
        clientIP,
        userAgent: userAgent?.substring(0, 100)
      });

      return res.status(403).json({
        error: 'QueueAccessDenied',
        message: 'Token de acceso inválido o expirado'
      });
    }

    // Verificar acceso de cola
    const hasAccess = await queueService.verifyAccess(showId, userId, accessToken);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'QueueAccessDenied',
        message: 'Debes obtener acceso a través de la cola virtual'
      });
    }

    // Marcar token como usado (prevenir reutilización)
    await markTokenAsUsed(accessToken);

    next();
  } catch (error) {
    console.error('Queue access middleware error:', error);
    
    // En producción, ser más estricto con errores
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        error: 'QueueVerificationError',
        message: 'Error verificando acceso de cola'
      });
    }
    
    // En desarrollo, permitir continuar
    next();
  }
};

/**
 * Verifica si un show requiere cola virtual
 */
async function isQueueRequired(showId) {
  if (!isConnected()) return false;
  
  try {
    const queueEnabled = await redisClient.get(`queue:${showId}:enabled`);
    return queueEnabled === 'true';
  } catch (error) {
    console.error('Error verificando si cola es requerida:', error);
    return false;
  }
}

/**
 * Verifica token con binding de seguridad
 */
async function verifySecureToken(token, context) {
  if (!isConnected()) return true; // Fallback si Redis no está disponible
  
  try {
    // Obtener datos del token desde Redis
    const tokenData = await redisClient.get(`queue_token:${token}`);
    
    if (!tokenData) {
      return false; // Token no existe o expiró
    }

    const data = JSON.parse(tokenData);
    
    // Verificar binding básico
    if (data.showId !== context.showId || data.userId !== context.userId) {
      return false;
    }

    // Verificar binding de User-Agent (flexible para actualizaciones de browser)
    if (data.userAgent && context.userAgent) {
      const similarity = calculateStringSimilarity(data.userAgent, context.userAgent);
      if (similarity < 0.7) { // 70% de similitud mínima
        console.warn('User-Agent mismatch en token de cola:', {
          original: data.userAgent?.substring(0, 50),
          current: context.userAgent?.substring(0, 50),
          similarity
        });
      }
    }

    // Verificar binding de IP (más flexible para NAT/proxies)
    if (data.clientIP && context.clientIP) {
      const ipMatch = data.clientIP === context.clientIP;
      if (!ipMatch) {
        // Permitir cambio de IP pero logearlo
        console.info('IP change detectado en token de cola:', {
          original: data.clientIP,
          current: context.clientIP,
          userId: context.userId
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Error verificando token seguro:', error);
    return false;
  }
}

/**
 * Marca un token como usado para prevenir reutilización
 */
async function markTokenAsUsed(token) {
  if (!isConnected()) return;
  
  try {
    const usedKey = `queue_token_used:${token}`;
    await redisClient.setex(usedKey, 3600, Date.now()); // Marcar por 1 hora
  } catch (error) {
    console.error('Error marcando token como usado:', error);
  }
}

/**
 * Calcula similitud entre strings (algoritmo simple)
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calcula distancia de Levenshtein (simplificado)
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
