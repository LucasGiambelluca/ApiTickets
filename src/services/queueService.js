const { client, isConnected } = require('../redis');
const { v4: uuidv4 } = require('uuid');

class QueueService {
  constructor() {
    this.QUEUE_PREFIX = 'queue:show:';
    this.USER_PREFIX = 'user:queue:';
    this.POSITION_PREFIX = 'position:';
    this.MAX_QUEUE_SIZE = parseInt(process.env.QUEUE_MAX_SIZE) || 1000;
    this.TIMEOUT_MINUTES = parseInt(process.env.QUEUE_TIMEOUT_MINUTES) || 15;
  }

  // Generar clave de cola para un show específico
  getQueueKey(showId) {
    return `${this.QUEUE_PREFIX}${showId}`;
  }

  // Generar clave de usuario en cola
  getUserQueueKey(userId) {
    return `${this.USER_PREFIX}${userId}`;
  }

  // Generar clave de posición
  getPositionKey(showId, userId) {
    return `${this.POSITION_PREFIX}${showId}:${userId}`;
  }

  // Verificar si Redis está disponible
  _checkRedis() {
    if (!isConnected()) {
      throw new Error('Cola virtual no disponible - Redis desconectado');
    }
  }

  // Agregar usuario a la cola
  async joinQueue(showId, userId, userInfo = {}) {
    this._checkRedis();
    try {
      const queueKey = this.getQueueKey(showId);
      const userQueueKey = this.getUserQueueKey(userId);
      const positionKey = this.getPositionKey(showId, userId);

      // Verificar si el usuario ya está en alguna cola
      const existingQueue = await client.get(userQueueKey);
      if (existingQueue) {
        throw new Error('Usuario ya está en una cola');
      }

      // Verificar tamaño de la cola
      const queueSize = await client.lLen(queueKey);
      if (queueSize >= this.MAX_QUEUE_SIZE) {
        throw new Error('Cola llena');
      }

      const queueEntry = {
        userId,
        showId,
        joinedAt: new Date().toISOString(),
        sessionId: uuidv4(),
        ...userInfo
      };

      // Agregar a la cola
      await client.rPush(queueKey, JSON.stringify(queueEntry));
      
      // Marcar que el usuario está en cola
      await client.setEx(userQueueKey, this.TIMEOUT_MINUTES * 60, showId);
      
      // Obtener posición en la cola
      const position = await this.getQueuePosition(showId, userId);
      
      return {
        success: true,
        position,
        sessionId: queueEntry.sessionId,
        estimatedWaitTime: position * 30, // 30 segundos por persona estimado
        queueSize: queueSize + 1
      };
    } catch (error) {
      throw error;
    }
  }

  // Obtener posición en la cola
  async getQueuePosition(showId, userId) {
    this._checkRedis();
    try {
      const queueKey = this.getQueueKey(showId);
      const queueLength = await client.lLen(queueKey);
      
      for (let i = 0; i < queueLength; i++) {
        const entry = await client.lIndex(queueKey, i);
        if (entry) {
          const parsed = JSON.parse(entry);
          if (parsed.userId === userId) {
            return i + 1; // Posición 1-indexed
          }
        }
      }
      return -1; // No encontrado
    } catch (error) {
      throw error;
    }
  }

  // Procesar siguiente en la cola (dar acceso)
  async processNext(showId) {
    try {
      const queueKey = this.getQueueKey(showId);
      const nextEntry = await client.lPop(queueKey);
      
      if (!nextEntry) {
        return null;
      }

      const parsed = JSON.parse(nextEntry);
      const userQueueKey = this.getUserQueueKey(parsed.userId);
      
      // Remover marca de usuario en cola
      await client.del(userQueueKey);
      
      // Crear token de acceso temporal (15 minutos)
      const accessToken = uuidv4();
      const accessKey = `access:${showId}:${parsed.userId}`;
      await client.setEx(accessKey, 15 * 60, accessToken);
      
      return {
        userId: parsed.userId,
        showId,
        accessToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // Verificar token de acceso
  async verifyAccess(showId, userId, accessToken) {
    try {
      const accessKey = `access:${showId}:${userId}`;
      const storedToken = await client.get(accessKey);
      return storedToken === accessToken;
    } catch (error) {
      return false;
    }
  }

  // Salir de la cola
  async leaveQueue(showId, userId) {
    try {
      const queueKey = this.getQueueKey(showId);
      const userQueueKey = this.getUserQueueKey(userId);
      
      // Buscar y remover de la cola
      const queueLength = await client.lLen(queueKey);
      for (let i = 0; i < queueLength; i++) {
        const entry = await client.lIndex(queueKey, i);
        if (entry) {
          const parsed = JSON.parse(entry);
          if (parsed.userId === userId) {
            await client.lRem(queueKey, 1, entry);
            break;
          }
        }
      }
      
      // Remover marca de usuario en cola
      await client.del(userQueueKey);
      
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Obtener estado de la cola
  async getQueueStatus(showId) {
    try {
      const queueKey = this.getQueueKey(showId);
      const queueSize = await client.lLen(queueKey);
      
      return {
        showId,
        queueSize,
        maxSize: this.MAX_QUEUE_SIZE,
        isOpen: queueSize < this.MAX_QUEUE_SIZE
      };
    } catch (error) {
      throw error;
    }
  }

  // Limpiar colas expiradas (ejecutar periódicamente)
  async cleanExpiredQueues() {
    try {
      const pattern = `${this.QUEUE_PREFIX}*`;
      const keys = await client.keys(pattern);
      
      for (const key of keys) {
        const queueLength = await client.lLen(key);
        const expiredEntries = [];
        
        for (let i = 0; i < queueLength; i++) {
          const entry = await client.lIndex(key, i);
          if (entry) {
            const parsed = JSON.parse(entry);
            const joinedAt = new Date(parsed.joinedAt);
            const now = new Date();
            const diffMinutes = (now - joinedAt) / (1000 * 60);
            
            if (diffMinutes > this.TIMEOUT_MINUTES) {
              expiredEntries.push(entry);
              // Limpiar marca de usuario
              const userQueueKey = this.getUserQueueKey(parsed.userId);
              await client.del(userQueueKey);
            }
          }
        }
        
        // Remover entradas expiradas
        for (const expiredEntry of expiredEntries) {
          await client.lRem(key, 1, expiredEntry);
        }
      }
    } catch (error) {
      console.error('Error cleaning expired queues:', error);
    }
  }
}

module.exports = new QueueService();
