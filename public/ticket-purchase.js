// Sistema de compra de tickets
class TicketPurchaseSystem {
  constructor() {
    this.selectedTickets = [];
    this.currentEvent = null;
    this.reservation = null;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Event listeners para la compra de tickets
    document.addEventListener('click', (e) => {
      if (e.target.matches('.btn-buy-tickets')) {
        const eventId = e.target.dataset.eventId;
        this.showTicketPurchaseModal(eventId);
      }
      
      if (e.target.matches('.ticket-quantity-btn')) {
        this.handleQuantityChange(e.target);
      }
      
      if (e.target.matches('.btn-reserve-tickets')) {
        this.createReservation();
      }
      
      if (e.target.matches('.btn-proceed-payment')) {
        this.proceedToPayment();
      }
    });
  }

  async showTicketPurchaseModal(eventId) {
    try {
      // Obtener información del evento y tipos de tickets
      const [eventResponse, ticketTypesResponse] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/ticket-types`)
      ]);

      if (!eventResponse.ok || !ticketTypesResponse.ok) {
        throw new Error('Error al cargar información del evento');
      }

      this.currentEvent = await eventResponse.json();
      const ticketData = await ticketTypesResponse.json();

      this.renderTicketPurchaseModal(ticketData);
      this.showModal('ticketPurchaseModal');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cargar los tickets disponibles', 'error');
    }
  }

  renderTicketPurchaseModal(ticketData) {
    const { event, ticketTypes } = ticketData;
    
    const modalHTML = `
      <div id="ticketPurchaseModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Comprar Tickets - ${event.name}</h2>
            <span class="close" onclick="closeModal('ticketPurchaseModal')">&times;</span>
          </div>
          <div class="modal-body">
            <div class="event-info">
              <h3>${event.name}</h3>
              <p><i class="fas fa-map-marker-alt"></i> ${event.venue_name || 'Venue por confirmar'}</p>
              <p><i class="fas fa-calendar"></i> ${event.shows?.[0]?.starts_at ? new Date(event.shows[0].starts_at).toLocaleDateString('es-ES') : 'Fecha por confirmar'}</p>
            </div>
            
            <div class="ticket-types">
              <h4>Selecciona tus tickets:</h4>
              ${ticketTypes.map(ticket => this.renderTicketType(ticket)).join('')}
            </div>
            
            <div class="purchase-summary" id="purchaseSummary" style="display: none;">
              <h4>Resumen de compra:</h4>
              <div id="summaryContent"></div>
              <div class="total-amount">
                <strong>Total: $<span id="totalAmount">0</span></strong>
              </div>
            </div>
            
            <div class="customer-info" id="customerInfo" style="display: none;">
              <h4>Información del comprador:</h4>
              <form id="customerForm">
                <div class="form-group">
                  <label for="customerName">Nombre completo *</label>
                  <input type="text" id="customerName" required>
                </div>
                <div class="form-group">
                  <label for="customerEmail">Email *</label>
                  <input type="email" id="customerEmail" required>
                </div>
                <div class="form-group">
                  <label for="customerPhone">Teléfono</label>
                  <input type="tel" id="customerPhone">
                </div>
              </form>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal('ticketPurchaseModal')">Cancelar</button>
            <button type="button" class="btn btn-primary btn-reserve-tickets" id="reserveBtn" style="display: none;">Reservar Tickets</button>
            <button type="button" class="btn btn-success btn-proceed-payment" id="paymentBtn" style="display: none;">Proceder al Pago</button>
          </div>
        </div>
      </div>
    `;

    // Remover modal existente si existe
    const existingModal = document.getElementById('ticketPurchaseModal');
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.selectedTickets = [];
  }

  renderTicketType(ticket) {
    const isAvailable = ticket.availability === 'available';
    const statusText = this.getTicketStatusText(ticket);
    
    return `
      <div class="ticket-type ${!isAvailable ? 'unavailable' : ''}" data-ticket-id="${ticket.id}">
        <div class="ticket-info">
          <h5>${ticket.name}</h5>
          <p class="ticket-description">${ticket.description || ''}</p>
          <div class="ticket-price">$${ticket.price}</div>
          <div class="ticket-availability">
            <span class="availability-badge ${ticket.availability}">${statusText}</span>
            <small>${ticket.available} de ${ticket.quantity_total} disponibles</small>
          </div>
        </div>
        <div class="ticket-selector">
          ${isAvailable ? `
            <div class="quantity-controls">
              <button type="button" class="ticket-quantity-btn" data-action="decrease" data-ticket-id="${ticket.id}">-</button>
              <span class="quantity-display" id="quantity-${ticket.id}">0</span>
              <button type="button" class="ticket-quantity-btn" data-action="increase" data-ticket-id="${ticket.id}">+</button>
            </div>
          ` : `
            <div class="unavailable-message">No disponible</div>
          `}
        </div>
      </div>
    `;
  }

  getTicketStatusText(ticket) {
    switch (ticket.availability) {
      case 'available': return 'Disponible';
      case 'low_stock': return 'Pocas unidades';
      case 'sold_out': return 'Agotado';
      case 'not_started': return 'Venta no iniciada';
      case 'ended': return 'Venta finalizada';
      case 'inactive': return 'No disponible';
      default: return 'No disponible';
    }
  }

  handleQuantityChange(button) {
    const action = button.dataset.action;
    const ticketId = parseInt(button.dataset.ticketId);
    const quantityDisplay = document.getElementById(`quantity-${ticketId}`);
    const currentQuantity = parseInt(quantityDisplay.textContent);
    
    let newQuantity = currentQuantity;
    
    if (action === 'increase' && currentQuantity < 10) {
      newQuantity = currentQuantity + 1;
    } else if (action === 'decrease' && currentQuantity > 0) {
      newQuantity = currentQuantity - 1;
    }
    
    quantityDisplay.textContent = newQuantity;
    this.updateSelectedTickets(ticketId, newQuantity);
    this.updatePurchaseSummary();
  }

  updateSelectedTickets(ticketId, quantity) {
    const existingIndex = this.selectedTickets.findIndex(t => t.typeId === ticketId);
    
    if (quantity === 0) {
      if (existingIndex !== -1) {
        this.selectedTickets.splice(existingIndex, 1);
      }
    } else {
      if (existingIndex !== -1) {
        this.selectedTickets[existingIndex].quantity = quantity;
      } else {
        this.selectedTickets.push({ typeId: ticketId, quantity });
      }
    }
  }

  updatePurchaseSummary() {
    const summaryDiv = document.getElementById('purchaseSummary');
    const summaryContent = document.getElementById('summaryContent');
    const totalAmountSpan = document.getElementById('totalAmount');
    const customerInfo = document.getElementById('customerInfo');
    const reserveBtn = document.getElementById('reserveBtn');
    
    if (this.selectedTickets.length === 0) {
      summaryDiv.style.display = 'none';
      customerInfo.style.display = 'none';
      reserveBtn.style.display = 'none';
      return;
    }
    
    // Obtener información de los tickets seleccionados
    let totalAmount = 0;
    let summaryHTML = '<ul>';
    
    this.selectedTickets.forEach(selected => {
      const ticketElement = document.querySelector(`[data-ticket-id="${selected.typeId}"]`);
      const ticketName = ticketElement.querySelector('h5').textContent;
      const priceText = ticketElement.querySelector('.ticket-price').textContent;
      const price = parseFloat(priceText.replace('$', ''));
      const subtotal = price * selected.quantity;
      totalAmount += subtotal;
      
      summaryHTML += `<li>${selected.quantity}x ${ticketName} - $${subtotal.toFixed(2)}</li>`;
    });
    
    summaryHTML += '</ul>';
    summaryContent.innerHTML = summaryHTML;
    totalAmountSpan.textContent = totalAmount.toFixed(2);
    
    summaryDiv.style.display = 'block';
    customerInfo.style.display = 'block';
    reserveBtn.style.display = 'inline-block';
  }

  async createReservation() {
    const form = document.getElementById('customerForm');
    const formData = new FormData(form);
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const customerInfo = {
      name: formData.get('customerName') || document.getElementById('customerName').value,
      email: formData.get('customerEmail') || document.getElementById('customerEmail').value,
      phone: formData.get('customerPhone') || document.getElementById('customerPhone').value
    };
    
    try {
      const response = await fetch('/api/tickets/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId: this.currentEvent.id,
          tickets: this.selectedTickets,
          customerInfo
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear la reserva');
      }
      
      this.reservation = await response.json();
      
      showToast('Reserva creada exitosamente. Tienes 15 minutos para completar el pago.', 'success');
      
      // Mostrar botón de pago
      document.getElementById('reserveBtn').style.display = 'none';
      document.getElementById('paymentBtn').style.display = 'inline-block';
      
      // Mostrar información de la reserva
      this.showReservationInfo();
      
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message, 'error');
    }
  }

  showReservationInfo() {
    const customerInfo = document.getElementById('customerInfo');
    const expiresAt = new Date(this.reservation.expiresAt);
    
    customerInfo.insertAdjacentHTML('afterend', `
      <div class="reservation-info">
        <div class="alert alert-info">
          <h5><i class="fas fa-clock"></i> Reserva confirmada</h5>
          <p>Tu reserva expira el ${expiresAt.toLocaleString('es-ES')}</p>
          <p>Total a pagar: <strong>$${this.reservation.totalAmountFormatted}</strong></p>
        </div>
      </div>
    `);
  }

  async proceedToPayment() {
    if (!this.reservation) {
      showToast('No hay reserva activa', 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/payments/create-preference-reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reservationIds: this.reservation.reservationIds,
          payer: {
            name: this.reservation.customer.name.split(' ')[0],
            surname: this.reservation.customer.name.split(' ').slice(1).join(' ') || '',
            email: this.reservation.customer.email
          },
          backUrls: {
            success: `${window.location.origin}/payment/success`,
            failure: `${window.location.origin}/payment/failure`,
            pending: `${window.location.origin}/payment/pending`
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear la preferencia de pago');
      }
      
      const paymentData = await response.json();
      
      // Redirigir a MercadoPago
      window.open(paymentData.initPoint, '_blank');
      
      showToast('Redirigiendo a MercadoPago...', 'info');
      
      // Cerrar modal después de un momento
      setTimeout(() => {
        closeModal('ticketPurchaseModal');
      }, 2000);
      
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message, 'error');
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  }
}

// Función global para cerrar modales
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Inicializar el sistema de compra de tickets
document.addEventListener('DOMContentLoaded', () => {
  window.ticketPurchaseSystem = new TicketPurchaseSystem();
});

// Estilos CSS adicionales para el sistema de compra
const ticketPurchaseStyles = `
<style>
.ticket-type {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
}

.ticket-type:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0,123,255,0.1);
}

.ticket-type.unavailable {
  opacity: 0.6;
  background-color: #f8f9fa;
}

.ticket-info h5 {
  margin: 0 0 8px 0;
  color: #333;
}

.ticket-description {
  color: #666;
  font-size: 14px;
  margin: 4px 0;
}

.ticket-price {
  font-size: 20px;
  font-weight: bold;
  color: #28a745;
  margin: 8px 0;
}

.availability-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.availability-badge.available {
  background-color: #d4edda;
  color: #155724;
}

.availability-badge.low_stock {
  background-color: #fff3cd;
  color: #856404;
}

.availability-badge.sold_out {
  background-color: #f8d7da;
  color: #721c24;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ticket-quantity-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.ticket-quantity-btn:hover {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.quantity-display {
  font-size: 18px;
  font-weight: bold;
  min-width: 20px;
  text-align: center;
}

.purchase-summary {
  background-color: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
}

.purchase-summary ul {
  margin: 0;
  padding-left: 20px;
}

.total-amount {
  text-align: right;
  font-size: 18px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ddd;
}

.customer-info {
  margin: 16px 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.reservation-info {
  margin: 16px 0;
}

.alert {
  padding: 12px 16px;
  border-radius: 4px;
  margin: 8px 0;
}

.alert-info {
  background-color: #d1ecf1;
  border-color: #bee5eb;
  color: #0c5460;
}

.unavailable-message {
  color: #6c757d;
  font-style: italic;
}

.event-info {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.event-info h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.event-info p {
  margin: 4px 0;
  color: #666;
}

.event-info i {
  margin-right: 8px;
  color: #007bff;
}
</style>
`;

// Agregar estilos al documento
document.head.insertAdjacentHTML('beforeend', ticketPurchaseStyles);
