module.exports = function requireFields(fields = []) {
    return (req, res, next) => {
      const missing = fields.filter((f) => !(f in req.body));
      if (missing.length) {
        const err = new Error(`Faltan campos: ${missing.join(', ')}`);
        err.status = 400;
        err.code = 'BadRequest';
        return next(err);
      }
      next();
    };
  };
  