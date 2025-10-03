// Debe ir después de las rutas en server.js
module.exports = function errorHandler(err, req, res, _next) {
    console.error(err);
    if (res.headersSent) return;
    const status = err.status || 500;
    const payload = {
      error: err.code || 'InternalError',
      message: err.message || 'Algo salió mal',
    };
    res.status(status).json(payload);
  };
  