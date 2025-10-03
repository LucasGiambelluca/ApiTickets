const queueService = require('../services/queueService');

class QueueCleanupTask {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  // Iniciar tarea de limpieza (ejecutar cada 5 minutos)
  start() {
    if (this.isRunning) {
      console.log('Queue cleanup task is already running');
      return;
    }

    console.log('Starting queue cleanup task...');
    this.isRunning = true;
    
    // Ejecutar inmediatamente
    this.cleanup();
    
    // Programar ejecución cada 5 minutos
    this.intervalId = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5 minutos
  }

  // Detener tarea de limpieza
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Queue cleanup task stopped');
  }

  // Ejecutar limpieza
  async cleanup() {
    try {
      console.log('Running queue cleanup...');
      await queueService.cleanExpiredQueues();
      console.log('Queue cleanup completed');
    } catch (error) {
      console.error('Queue cleanup error:', error);
    }
  }
}

module.exports = new QueueCleanupTask();
