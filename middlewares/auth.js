const jwt = require('jsonwebtoken');
const { client: redisClient } = require('../src/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Roles del sistema
const ROLES = {
  ADMIN: 'admin',
  PRODUCER: 'producer',
  USER: 'user'
};

/**
 * Genera un JWT token
 */
function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verifica un JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Token expirado');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }
    const err = new Error('Token inválido');
    err.code = 'INVALID_TOKEN';
    throw err;
  }
}

/**
 * Middleware de autenticación
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Token de autenticación requerido' 
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      producerId: decoded.producerId,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({ 
        error: 'TokenExpired',
        message: 'El token ha expirado' 
      });
    }
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Token inválido' 
    });
  }
}

/**
 * Middleware de autorización por roles
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Autenticación requerida' 
      });
    }

    // Admin siempre tiene acceso
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Permisos insuficientes' 
      });
    }

    next();
  };
}

/**
 * Middleware para verificar ownership de recursos (previene IDOR)
 */
function requireOwnership(getOwnerId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Admin siempre tiene acceso
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }

      const ownerId = await getOwnerId(req);

      if (!ownerId) {
        return res.status(404).json({ error: 'NotFound' });
      }

      const isOwner = String(ownerId) === String(req.user.userId) || 
                      String(ownerId) === String(req.user.producerId);

      if (!isOwner) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'No tienes permiso para acceder a este recurso' 
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Autenticación opcional (no rechaza si no hay token)
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        producerId: decoded.producerId,
        email: decoded.email
      };
    }
  } catch (error) {
    // Ignorar errores en auth opcional
  }
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  authorize,
  requireOwnership,
  optionalAuth,
  ROLES
};
