require('dotenv').config();
const { createClient } = require('redis');
const CircuitBreaker = require('./utils/circuitBreaker');
const { createRetryManager } = require('./utils/retry');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryManager = createRetryManager.redis();
    
    // Circuit breaker para operaciones Redis
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000, // 30 segundos
      onStateChange: (state) => {
        console.log(`🔄 Redis Circuit Breaker: ${state}`);
      }
    });

    this.initialize();
  }

  async initialize() {
    try {
      this.client = createClient({
        socket: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: process.env.REDIS_PORT || 6379,
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ Redis: Max reconnection attempts reached');
              return false;
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          }
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: 0
      });

      this.setupEventHandlers();
      await this.connect();
      
    } catch (error) {
      console.warn('⚠️  Redis initialization failed - Queue functionality will be disabled');
      console.warn('   Error:', error.message);
      this.isConnected = false;
    }
  }

  setupEventHandlers() {
    this.client.on('error', (err) => {
      console.error('🔴 Redis Client Error:', err.message);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('🟡 Redis: Connecting...');
    });

    this.client.on('ready', () => {
      console.log('🟢 Redis: Client ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      console.log('🔴 Redis: Connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🟡 Redis: Reconnecting...');
      this.isConnected = false;
    });
  }

  async connect() {
    try {
      await this.retryManager.execute(async () => {
        await this.client.connect();
      });
      
      this.isConnected = true;
      console.log('✅ Redis connected successfully');
      
    } catch (error) {
      console.warn('⚠️  Redis connection failed - Queue functionality will be disabled');
      console.warn('   To enable queue: Ensure Redis is running and restart the application');
      this.isConnected = false;
    }
  }

  // Wrapper para operaciones Redis con circuit breaker
  async executeOperation(operation) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    return await this.circuitBreaker.execute(operation);
  }

  // Métodos proxy para operaciones comunes
  async get(key) {
    return await this.executeOperation(() => this.client.get(key));
  }

  async set(key, value, options = {}) {
    return await this.executeOperation(() => this.client.set(key, value, options));
  }

  async setEx(key, seconds, value) {
    return await this.executeOperation(() => this.client.setEx(key, seconds, value));
  }

  async del(key) {
    return await this.executeOperation(() => this.client.del(key));
  }

  async lPush(key, ...values) {
    return await this.executeOperation(() => this.client.lPush(key, ...values));
  }

  async rPush(key, ...values) {
    return await this.executeOperation(() => this.client.rPush(key, ...values));
  }

  async lPop(key) {
    return await this.executeOperation(() => this.client.lPop(key));
  }

  async lLen(key) {
    return await this.executeOperation(() => this.client.lLen(key));
  }

  async lIndex(key, index) {
    return await this.executeOperation(() => this.client.lIndex(key, index));
  }

  async lRem(key, count, element) {
    return await this.executeOperation(() => this.client.lRem(key, count, element));
  }

  async keys(pattern) {
    return await this.executeOperation(() => this.client.keys(pattern));
  }

  async ping() {
    return await this.executeOperation(() => this.client.ping());
  }

  async quit() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      circuitBreaker: this.circuitBreaker.getState()
    };
  }
}

// Singleton instance
const redisManager = new RedisManager();

module.exports = {
  client: redisManager,
  isConnected: () => redisManager.isConnected
};
