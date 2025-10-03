// Sistema de reportes para eventos
class ReportsSystem {
  constructor() {
    this.currentEventId = null;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('.btn-view-report')) {
        const eventId = e.target.dataset.eventId;
        this.showEventReport(eventId);
      }
      
      if (e.target.matches('.btn-dashboard-reports')) {
        this.showDashboardReports();
      }
      
      if (e.target.matches('.btn-sales-report')) {
        this.showSalesReport();
      }
    });
  }

  async showEventReport(eventId) {
    try {
      showLoading('Cargando reporte del evento...');
      
      const response = await fetch(`/api/reports/event/${eventId}`);
      if (!response.ok) {
        throw new Error('Error al cargar el reporte del evento');
      }
      
      const reportData = await response.json();
      this.renderEventReport(reportData);
      this.showModal('eventReportModal');
      
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message, 'error');
    } finally {
      hideLoading();
    }
  }

  renderEventReport(data) {
    const { event, summary, ticketTypes, salesTimeline, topCustomers, analytics } = data;
    
    const modalHTML = `
      <div id="eventReportModal" class="modal modal-large">
        <div class="modal-content">
          <div class="modal-header">
            <h2><i class="fas fa-chart-bar"></i> Reporte: ${event.name}</h2>
            <span class="close" onclick="closeModal('eventReportModal')">&times;</span>
          </div>
          <div class="modal-body">
            <!-- Información del evento -->
            <div class="report-section">
              <h3>Información del Evento</h3>
              <div class="event-details">
                <div class="detail-item">
                  <strong>Venue:</strong> ${event.venue.name}
                  ${event.venue.city ? `, ${event.venue.city}` : ''}
                </div>
                <div class="detail-item">
                  <strong>Shows:</strong> ${event.shows.count}
                  ${event.shows.firstShow ? `(${new Date(event.shows.firstShow).toLocaleDateString('es-ES')})` : ''}
                </div>
                <div class="detail-item">
                  <strong>Creado:</strong> ${new Date(event.created_at).toLocaleDateString('es-ES')}
                </div>
              </div>
            </div>

            <!-- Resumen de ventas -->
            <div class="report-section">
              <h3>Resumen de Ventas</h3>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">${summary.totalTicketsSold}</div>
                  <div class="stat-label">Tickets Vendidos</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">$${summary.totalRevenueFormatted}</div>
                  <div class="stat-label">Ingresos Totales</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${summary.occupancyRate}%</div>
                  <div class="stat-label">Ocupación</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${summary.uniqueCustomers}</div>
                  <div class="stat-label">Clientes Únicos</div>
                </div>
              </div>
            </div>

            <!-- Desglose por tipo de ticket -->
            <div class="report-section">
              <h3>Ventas por Tipo de Ticket</h3>
              <div class="ticket-breakdown">
                ${ticketTypes.map(ticket => this.renderTicketBreakdown(ticket)).join('')}
              </div>
            </div>

            <!-- Gráfico de ventas en el tiempo -->
            <div class="report-section">
              <h3>Evolución de Ventas</h3>
              <div class="chart-container">
                <canvas id="salesChart" width="400" height="200"></canvas>
              </div>
            </div>

            <!-- Top compradores -->
            <div class="report-section">
              <h3>Principales Compradores</h3>
              <div class="top-customers">
                ${topCustomers.slice(0, 5).map(customer => this.renderTopCustomer(customer)).join('')}
              </div>
            </div>

            <!-- Analytics avanzados -->
            <div class="report-section">
              <h3>Análisis Avanzado</h3>
              <div class="analytics-grid">
                <div class="analytics-card">
                  <h4>Análisis de Precios</h4>
                  <div class="price-analysis">
                    <div class="price-item">
                      <span>Precio Promedio:</span>
                      <strong>$${analytics.priceAnalysis.average}</strong>
                    </div>
                    <div class="price-item">
                      <span>Precio Máximo:</span>
                      <strong>$${analytics.priceAnalysis.maximum}</strong>
                    </div>
                    <div class="price-item">
                      <span>Precio Mínimo:</span>
                      <strong>$${analytics.priceAnalysis.minimum}</strong>
                    </div>
                  </div>
                </div>
                <div class="analytics-card">
                  <h4>Proyecciones</h4>
                  <div class="projections">
                    <div class="projection-item">
                      <span>Ingresos Estimados:</span>
                      <strong>$${analytics.projections.estimatedFinalRevenue}</strong>
                    </div>
                    <div class="projection-item">
                      <span>Tickets Estimados:</span>
                      <strong>${analytics.projections.estimatedFinalTickets}</strong>
                    </div>
                    <div class="projection-item">
                      <span>Días Restantes:</span>
                      <strong>${analytics.projections.daysRemaining}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal('eventReportModal')">Cerrar</button>
            <button type="button" class="btn btn-primary" onclick="window.print()">
              <i class="fas fa-print"></i> Imprimir
            </button>
          </div>
        </div>
      </div>
    `;

    // Remover modal existente
    const existingModal = document.getElementById('eventReportModal');
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Renderizar gráfico después de que el modal esté en el DOM
    setTimeout(() => {
      this.renderSalesChart(salesTimeline);
    }, 100);
  }

  renderTicketBreakdown(ticket) {
    const progressPercentage = ticket.soldPercentage || 0;
    
    return `
      <div class="ticket-breakdown-item">
        <div class="ticket-info">
          <h4>${ticket.name}</h4>
          <div class="ticket-stats">
            <span class="stat">Precio: $${ticket.price}</span>
            <span class="stat">Vendidos: ${ticket.sold}/${ticket.total}</span>
            <span class="stat">Ingresos: $${ticket.revenue}</span>
          </div>
        </div>
        <div class="ticket-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercentage}%"></div>
          </div>
          <span class="progress-text">${progressPercentage}% vendido</span>
        </div>
      </div>
    `;
  }

  renderTopCustomer(customer) {
    return `
      <div class="customer-item">
        <div class="customer-info">
          <strong>${customer.name}</strong>
          <small>${customer.email}</small>
        </div>
        <div class="customer-stats">
          <span class="tickets">${customer.totalTickets} tickets</span>
          <span class="amount">$${customer.totalSpent}</span>
        </div>
      </div>
    `;
  }

  renderSalesChart(salesData) {
    const canvas = document.getElementById('salesChart');
    if (!canvas || !salesData.length) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);
    
    // Preparar datos
    const maxRevenue = Math.max(...salesData.map(d => d.revenueCents));
    const maxTickets = Math.max(...salesData.map(d => d.ticketsSold));
    
    if (maxRevenue === 0) return;
    
    // Configuración del gráfico
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Dibujar ejes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    // Eje Y
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();
    
    // Eje X
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Dibujar línea de ventas
    if (salesData.length > 1) {
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      salesData.forEach((data, index) => {
        const x = padding + (index / (salesData.length - 1)) * chartWidth;
        const y = height - padding - (data.revenueCents / maxRevenue) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Dibujar puntos
      ctx.fillStyle = '#007bff';
      salesData.forEach((data, index) => {
        const x = padding + (index / (salesData.length - 1)) * chartWidth;
        const y = height - padding - (data.revenueCents / maxRevenue) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    
    // Etiquetas del eje Y
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const value = (maxRevenue / 5) * i;
      const y = height - padding - (i / 5) * chartHeight;
      ctx.fillText(`$${(value / 100).toFixed(0)}`, padding - 10, y + 4);
    }
    
    // Etiquetas del eje X (fechas)
    ctx.textAlign = 'center';
    if (salesData.length > 0) {
      const step = Math.max(1, Math.floor(salesData.length / 5));
      for (let i = 0; i < salesData.length; i += step) {
        const x = padding + (i / (salesData.length - 1)) * chartWidth;
        const date = new Date(salesData[i].date);
        ctx.fillText(date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }), x, height - 10);
      }
    }
  }

  async showDashboardReports() {
    try {
      showLoading('Cargando dashboard de reportes...');
      
      const response = await fetch('/api/reports/events');
      if (!response.ok) {
        throw new Error('Error al cargar el dashboard de reportes');
      }
      
      const dashboardData = await response.json();
      this.renderDashboardReports(dashboardData);
      this.showModal('dashboardReportsModal');
      
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message, 'error');
    } finally {
      hideLoading();
    }
  }

  renderDashboardReports(data) {
    const { events, summary } = data;
    
    const modalHTML = `
      <div id="dashboardReportsModal" class="modal modal-large">
        <div class="modal-content">
          <div class="modal-header">
            <h2><i class="fas fa-tachometer-alt"></i> Dashboard de Reportes</h2>
            <span class="close" onclick="closeModal('dashboardReportsModal')">&times;</span>
          </div>
          <div class="modal-body">
            <!-- Resumen general -->
            <div class="report-section">
              <h3>Resumen General</h3>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">${summary.totalEvents}</div>
                  <div class="stat-label">Eventos Totales</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${summary.totalTicketsSold}</div>
                  <div class="stat-label">Tickets Vendidos</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">$${summary.totalRevenue}</div>
                  <div class="stat-label">Ingresos Totales</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${summary.totalCustomers}</div>
                  <div class="stat-label">Clientes Únicos</div>
                </div>
              </div>
            </div>

            <!-- Lista de eventos -->
            <div class="report-section">
              <h3>Rendimiento por Evento</h3>
              <div class="events-table">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th>Venue</th>
                      <th>Capacidad</th>
                      <th>Vendidos</th>
                      <th>Ocupación</th>
                      <th>Ingresos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${events.map(event => this.renderEventRow(event)).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal('dashboardReportsModal')">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    // Remover modal existente
    const existingModal = document.getElementById('dashboardReportsModal');
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  renderEventRow(event) {
    return `
      <tr>
        <td>
          <strong>${event.name}</strong>
          <br><small>${new Date(event.created_at).toLocaleDateString('es-ES')}</small>
        </td>
        <td>
          ${event.venue.name}
          ${event.venue.city ? `<br><small>${event.venue.city}</small>` : ''}
        </td>
        <td>${event.capacity || 'N/A'}</td>
        <td>${event.ticketsSold}</td>
        <td>
          <div class="occupancy-badge ${this.getOccupancyClass(event.occupancyRate)}">
            ${event.occupancyRate}%
          </div>
        </td>
        <td>$${event.revenue}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-view-report" data-event-id="${event.id}">
            Ver Reporte
          </button>
        </td>
      </tr>
    `;
  }

  getOccupancyClass(rate) {
    if (rate >= 80) return 'high';
    if (rate >= 50) return 'medium';
    return 'low';
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  }
}

// Funciones auxiliares para loading
function showLoading(message = 'Cargando...') {
  const loadingHTML = `
    <div id="loadingOverlay" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.remove();
  }
}

// Inicializar sistema de reportes
document.addEventListener('DOMContentLoaded', () => {
  window.reportsSystem = new ReportsSystem();
});

// Estilos CSS para reportes
const reportsStyles = `
<style>
.modal-large .modal-content {
  width: 90%;
  max-width: 1200px;
}

.report-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #eee;
}

.report-section:last-child {
  border-bottom: none;
}

.report-section h3 {
  margin-bottom: 16px;
  color: #333;
  font-size: 18px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.event-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.ticket-breakdown {
  space-y: 16px;
}

.ticket-breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 12px;
}

.ticket-info h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.ticket-stats {
  display: flex;
  gap: 16px;
}

.ticket-stats .stat {
  font-size: 14px;
  color: #666;
}

.ticket-progress {
  flex: 1;
  max-width: 200px;
  margin-left: 24px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #666;
}

.chart-container {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.top-customers {
  display: grid;
  gap: 12px;
}

.customer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.customer-info strong {
  display: block;
  color: #333;
}

.customer-info small {
  color: #666;
}

.customer-stats {
  text-align: right;
}

.customer-stats .tickets {
  display: block;
  font-size: 14px;
  color: #666;
}

.customer-stats .amount {
  font-weight: bold;
  color: #28a745;
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.analytics-card {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.analytics-card h4 {
  margin: 0 0 16px 0;
  color: #333;
}

.price-analysis, .projections {
  display: grid;
  gap: 8px;
}

.price-item, .projection-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #ddd;
}

.price-item:last-child, .projection-item:last-child {
  border-bottom: none;
}

.events-table {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.table th {
  background-color: #f8f9fa;
  font-weight: bold;
  color: #333;
}

.occupancy-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
}

.occupancy-badge.high {
  background-color: #d4edda;
  color: #155724;
}

.occupancy-badge.medium {
  background-color: #fff3cd;
  color: #856404;
}

.occupancy-badge.low {
  background-color: #f8d7da;
  color: #721c24;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.loading-content {
  background: white;
  padding: 32px;
  border-radius: 8px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media print {
  .modal-header, .modal-footer {
    display: none !important;
  }
  
  .modal-content {
    box-shadow: none !important;
    border: none !important;
  }
}
</style>
`;

// Agregar estilos al documento
document.head.insertAdjacentHTML('beforeend', reportsStyles);
