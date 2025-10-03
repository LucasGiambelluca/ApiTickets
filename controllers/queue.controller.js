const queueService = require('../src/services/queueService');
const Joi = require('joi');

// Esquemas de validación
const joinQueueSchema = Joi.object({
  userId: Joi.string().required(),
  userInfo: Joi.object({
    name: Joi.string(),
    email: Joi.string().email()
  }).optional()
});

const accessSchema = Joi.object({
  userId: Joi.string().required(),
  accessToken: Joi.string().required()
});

// Unirse a la cola
exports.joinQueue = async (req, res) => {
  try {
    const showId = Number(req.params.showId);
    const { error, value } = joinQueueSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'ValidationError',
        message: error.details[0].message
      });
    }

    const { userId, userInfo } = value;
    
    const result = await queueService.joinQueue(showId, userId, userInfo);
    
    res.status(201).json({
      message: 'Agregado a la cola exitosamente',
      ...result
    });
  } catch (error) {
    if (error.message === 'Usuario ya está en una cola') {
      return res.status(409).json({
        error: 'UserAlreadyInQueue',
        message: error.message
      });
    }
    if (error.message === 'Cola llena') {
      return res.status(503).json({
        error: 'QueueFull',
        message: 'La cola está llena, intenta más tarde'
      });
    }
    throw error;
  }
};

// Obtener posición en la cola
exports.getQueuePosition = async (req, res) => {
  try {
    const showId = Number(req.params.showId);
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'userId es requerido'
      });
    }

    const position = await queueService.getQueuePosition(showId, userId);
    
    if (position === -1) {
      return res.status(404).json({
        error: 'NotInQueue',
        message: 'Usuario no está en la cola'
      });
    }

    const queueStatus = await queueService.getQueueStatus(showId);
    
    res.json({
      showId,
      userId,
      position,
      estimatedWaitTime: position * 30, // 30 segundos por persona
      queueSize: queueStatus.queueSize
    });
  } catch (error) {
    throw error;
  }
};

// Procesar siguiente en la cola (admin)
exports.processNext = async (req, res) => {
  try {
    const showId = Number(req.params.showId);
    
    const result = await queueService.processNext(showId);
    
    if (!result) {
      return res.status(404).json({
        error: 'QueueEmpty',
        message: 'No hay usuarios en la cola'
      });
    }

    res.json({
      message: 'Usuario procesado exitosamente',
      ...result
    });
  } catch (error) {
    throw error;
  }
};

// Verificar acceso
exports.verifyAccess = async (req, res) => {
  try {
    const showId = Number(req.params.showId);
    const { error, value } = accessSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'ValidationError',
        message: error.details[0].message
      });
    }

    const { userId, accessToken } = value;
    
    const hasAccess = await queueService.verifyAccess(showId, userId, accessToken);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'AccessDenied',
        message: 'Token de acceso inválido o expirado'
      });
    }

    res.json({
      hasAccess: true,
      message: 'Acceso verificado exitosamente'
    });
  } catch (error) {
    throw error;
  }
};

// Salir de la cola
exports.leaveQueue = async (req, res) => {
  try {
    const showId = Number(req.params.showId);
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'userId es requerido'
      });
    }

    const result = await queueService.leaveQueue(showId, userId);
    
    res.json({
      message: 'Saliste de la cola exitosamente',
      ...result
    });
  } catch (error) {
    throw error;
  }
};

// Obtener estado de la cola
exports.getQueueStatus = async (req, res) => {
  try {
    const showId = Number(req.params.showId);
    
    const status = await queueService.getQueueStatus(showId);
    
    res.json(status);
  } catch (error) {
    throw error;
  }
};
