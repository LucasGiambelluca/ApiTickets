/**
 * 🛡️ MIDDLEWARE PARA MANEJO DE ERRORES DE BASE DE DATOS
 * 
 * Este middleware captura errores de conexión a la base de datos
 * y proporciona respuestas más amigables al usuario.
 */

const dbErrorHandler = (error, req, res, next) => {
  // Log del error para debugging
  console.error(`[DB Error] ${req.method} ${req.path}:`, {
    error: error.message,
    code: error.code,
    errno: error.errno,
    timestamp: new Date().toISOString(),
    ip: req.ip
  });

  // Errores específicos de MySQL
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'ServiceUnavailable',
      message: 'Base de datos temporalmente no disponible. Intente nuevamente en unos momentos.',
      code: 'DB_CONNECTION_REFUSED',
      timestamp: new Date().toISOString()
    });
  }

  if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    return res.status(504).json({
      error: 'GatewayTimeout',
      message: 'La consulta a la base de datos tardó demasiado tiempo. Intente nuevamente.',
      code: 'DB_TIMEOUT',
      timestamp: new Date().toISOString()
    });
  }

  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(503).json({
      error: 'ServiceUnavailable',
      message: 'Error de configuración de base de datos. Contacte al administrador.',
      code: 'DB_ACCESS_DENIED',
      timestamp: new Date().toISOString()
    });
  }

  if (error.code === 'ER_BAD_DB_ERROR') {
    return res.status(503).json({
      error: 'ServiceUnavailable',
      message: 'Base de datos no encontrada. Contacte al administrador.',
      code: 'DB_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  // Error genérico de base de datos
  if (error.sql || error.sqlMessage || error.errno) {
    return res.status(500).json({
      error: 'DatabaseError',
      message: 'Error interno de base de datos. Intente nuevamente.',
      code: 'DB_INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Si no es un error de DB, pasar al siguiente middleware
  next(error);
};

module.exports = dbErrorHandler;
