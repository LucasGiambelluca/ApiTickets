// Utilidad de reintentos con backoff exponencial
class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 segundo
    this.maxDelay = options.maxDelay || 30000; // 30 segundos
    this.backoffFactor = options.backoffFactor || 2;
    this.jitter = options.jitter || true;
  }

  async execute(operation, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation(attempt);
        
        if (attempt > 0) {
          console.log(`✅ Operation succeeded on attempt ${attempt + 1}/${this.maxRetries + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries) {
          console.error(`❌ Operation failed after ${this.maxRetries + 1} attempts:`, error.message);
          break;
        }

        // Verificar si el error es retryable
        if (!this.isRetryableError(error)) {
          console.log(`🚫 Non-retryable error, stopping attempts:`, error.message);
          break;
        }

        const delay = this.calculateDelay(attempt);
        console.log(`⏳ Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  calculateDelay(attempt) {
    let delay = this.baseDelay * Math.pow(this.backoffFactor, attempt);
    delay = Math.min(delay, this.maxDelay);
    
    if (this.jitter) {
      // Agregar jitter aleatorio ±25%
      const jitterRange = delay * 0.25;
      delay += (Math.random() * 2 - 1) * jitterRange;
    }
    
    return Math.floor(delay);
  }

  isRetryableError(error) {
    // Errores que NO son retryables
    const nonRetryableErrors = [
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError',
      'NotFound',
      'BadRequest'
    ];

    // Errores de red/conexión que SÍ son retryables
    const retryableErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE'
    ];

    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    if (error.code && nonRetryableErrors.includes(error.code)) {
      return false;
    }

    // HTTP status codes retryables
    if (error.status) {
      const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
      return retryableStatusCodes.includes(error.status);
    }

    // Por defecto, reintentar errores de conexión
    return error.message && (
      error.message.includes('connect') ||
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED')
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function para crear instancias comunes
const createRetryManager = {
  // Para operaciones de base de datos (más agresivo para health checks)
  database: () => new RetryManager({
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 3000
  }),

  // Para operaciones de Redis
  redis: () => new RetryManager({
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 5000
  }),

  // Para APIs externas (MercadoPago)
  external: () => new RetryManager({
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000
  }),

  // Para operaciones críticas
  critical: () => new RetryManager({
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 60000
  })
};

module.exports = { RetryManager, createRetryManager };
