const crypto = require('crypto');

/**
 * Middleware para verificar la firma de webhooks de MercadoPago
 * Previene ataques de replay y webhooks falsificados
 */
function verifyMercadoPagoWebhook(req, res, next) {
  try {
    // Obtener headers de MercadoPago
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    
    // MercadoPago envía la firma en el header x-signature
    if (!xSignature || !xRequestId) {
      console.error('Webhook sin firma o request ID', {
        hasSignature: !!xSignature,
        hasRequestId: !!xRequestId,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Firma de webhook inválida' 
      });
    }

    // Parsear la firma (formato: ts=timestamp,v1=hash)
    const signatureParts = {};
    xSignature.split(',').forEach(part => {
      const [key, value] = part.split('=');
      signatureParts[key] = value;
    });

    const timestamp = signatureParts.ts;
    const receivedHash = signatureParts.v1;

    if (!timestamp || !receivedHash) {
      console.error('Formato de firma inválido', { xSignature });
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Formato de firma inválido' 
      });
    }

    // Verificar que el webhook no sea muy antiguo (previene replay attacks)
    const webhookAge = Date.now() - (parseInt(timestamp) * 1000);
    const MAX_WEBHOOK_AGE = 5 * 60 * 1000; // 5 minutos

    if (webhookAge > MAX_WEBHOOK_AGE) {
      console.error('Webhook expirado', { 
        age: webhookAge,
        maxAge: MAX_WEBHOOK_AGE 
      });
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Webhook expirado' 
      });
    }

    // Obtener el secret de MercadoPago del webhook
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('MERCADOPAGO_WEBHOOK_SECRET no configurado');
      // En desarrollo, permitir sin verificación pero logear warning
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️  ADVERTENCIA: Webhook sin verificación de firma (solo desarrollo)');
        return next();
      }
      return res.status(500).json({ 
        error: 'ServerError',
        message: 'Configuración de webhook incompleta' 
      });
    }

    // Construir el mensaje para verificar (según docs de MercadoPago)
    // Formato: id + request-id + timestamp
    const dataId = req.body?.data?.id || req.query?.id || '';
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;

    // Calcular HMAC SHA256
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(manifest);
    const calculatedHash = hmac.digest('hex');

    // Comparar hashes de forma segura (previene timing attacks)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHash),
      Buffer.from(receivedHash)
    );

    if (!isValid) {
      console.error('Firma de webhook inválida', {
        received: receivedHash,
        calculated: calculatedHash,
        manifest,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Firma de webhook inválida' 
      });
    }

    // Firma válida, continuar
    req.webhookVerified = true;
    req.webhookRequestId = xRequestId;
    next();

  } catch (error) {
    console.error('Error verificando webhook:', error);
    return res.status(500).json({ 
      error: 'ServerError',
      message: 'Error verificando webhook' 
    });
  }
}

/**
 * Middleware de idempotencia para webhooks
 * Previene procesamiento duplicado usando Redis
 */
function webhookIdempotency(req, res, next) {
  const { client: redisClient, isConnected } = require('../src/redis');
  
  const requestId = req.webhookRequestId || req.headers['x-request-id'];
  
  if (!requestId) {
    return next();
  }

  if (!isConnected()) {
    console.warn('Redis no disponible para idempotencia de webhook');
    return next();
  }

  const idempotencyKey = `webhook:processed:${requestId}`;

  // Verificar si ya procesamos este webhook
  redisClient.get(idempotencyKey)
    .then(exists => {
      if (exists) {
        console.log('Webhook duplicado detectado', { requestId });
        // Retornar 200 para que MercadoPago no reintente
        return res.status(200).json({ 
          message: 'Webhook ya procesado',
          requestId 
        });
      }

      // Marcar como procesado (expira en 24 horas)
      redisClient.setex(idempotencyKey, 86400, Date.now().toString())
        .catch(err => console.error('Error guardando idempotencia:', err));

      next();
    })
    .catch(err => {
      console.error('Error verificando idempotencia:', err);
      // Continuar si hay error en Redis
      next();
    });
}

module.exports = {
  verifyMercadoPagoWebhook,
  webhookIdempotency
};
