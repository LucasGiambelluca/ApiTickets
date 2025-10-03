const Joi = require('joi');

/**
 * Schemas de validación para diferentes endpoints
 */
const schemas = {
  // Validación para crear eventos
  createEvent: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).optional(),
    venueId: Joi.number().integer().positive().required(),
    producerId: Joi.number().integer().positive().required(),
    startDate: Joi.date().iso().min('now').required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    status: Joi.string().valid('draft', 'published', 'cancelled').default('draft'),
    maxCapacity: Joi.number().integer().min(1).max(100000).optional(),
    ticketPrice: Joi.number().min(0).max(1000000).optional()
  }),

  // Validación para crear reservas
  createReservation: Joi.object({
    showId: Joi.number().integer().positive().required(),
    ticketTypeId: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).max(10).required(),
    userEmail: Joi.string().email().required(),
    userName: Joi.string().min(2).max(100).required(),
    userPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
  }),

  // Validación para pagos
  createPayment: Joi.object({
    orderId: Joi.string().uuid().optional(),
    reservationIds: Joi.array().items(Joi.string().uuid()).min(1).optional(),
    payer: Joi.object({
      email: Joi.string().email().required(),
      name: Joi.string().min(2).max(100).required(),
      surname: Joi.string().min(2).max(100).required(),
      phone: Joi.object({
        area_code: Joi.string().required(),
        number: Joi.string().required()
      }).optional(),
      identification: Joi.object({
        type: Joi.string().valid('DNI', 'CI', 'LC', 'LE', 'Passport').required(),
        number: Joi.string().required()
      }).optional()
    }).required(),
    backUrls: Joi.object({
      success: Joi.string().uri().required(),
      failure: Joi.string().uri().required(),
      pending: Joi.string().uri().required()
    }).required()
  }).or('orderId', 'reservationIds'),

  // Validación para configuración de MercadoPago
  mercadoPagoConfig: Joi.object({
    accessToken: Joi.string().pattern(/^(TEST-|APP_USR-)[a-zA-Z0-9_-]+$/).required(),
    publicKey: Joi.string().pattern(/^(TEST-|APP_USR-)[a-zA-Z0-9_-]+$/).required()
  }),

  // Validación para unirse a cola
  joinQueue: Joi.object({
    userEmail: Joi.string().email().required(),
    userName: Joi.string().min(2).max(100).required(),
    userAgent: Joi.string().max(500).optional(),
    fingerprint: Joi.string().max(100).optional()
  }),

  // Validación para crear venues
  createVenue: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    address: Joi.string().min(5).max(500).required(),
    city: Joi.string().min(2).max(100).required(),
    capacity: Joi.number().integer().min(1).max(100000).required(),
    description: Joi.string().max(2000).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional()
  }),

  // Validación para tipos de tickets
  createTicketType: Joi.object({
    eventId: Joi.number().integer().positive().required(),
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).optional(),
    price: Joi.number().min(0).max(1000000).required(),
    maxQuantity: Joi.number().integer().min(1).max(10000).required(),
    saleStartDate: Joi.date().iso().optional(),
    saleEndDate: Joi.date().iso().min(Joi.ref('saleStartDate')).optional(),
    isActive: Joi.boolean().default(true)
  })
};

/**
 * Middleware de validación genérico
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'ValidationError',
        message: 'Datos de entrada inválidos',
        details: errors
      });
    }

    // Reemplazar con datos validados y sanitizados
    req[property] = value;
    next();
  };
}

/**
 * Validación específica para parámetros de URL
 */
function validateParams(schema) {
  return validate(schema, 'params');
}

/**
 * Validación específica para query parameters
 */
function validateQuery(schema) {
  return validate(schema, 'query');
}

/**
 * Schemas para parámetros comunes
 */
const paramSchemas = {
  id: Joi.object({
    id: Joi.number().integer().positive().required()
  }),
  
  uuid: Joi.object({
    id: Joi.string().uuid().required()
  }),

  eventId: Joi.object({
    eventId: Joi.number().integer().positive().required()
  }),

  showId: Joi.object({
    showId: Joi.number().integer().positive().required()
  })
};

/**
 * Schemas para query parameters comunes
 */
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('id', 'name', 'created_at', 'updated_at').default('id'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC')
  }),

  search: Joi.object({
    q: Joi.string().min(2).max(100).optional(),
    status: Joi.string().valid('active', 'inactive', 'all').default('active')
  }).concat(querySchemas.pagination)
};

/**
 * Middleware de sanitización adicional
 */
function sanitizeInput(req, res, next) {
  // Sanitizar strings para prevenir XSS básico
  function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  
  next();
}

module.exports = {
  validate,
  validateParams,
  validateQuery,
  sanitizeInput,
  schemas,
  paramSchemas,
  querySchemas
};
