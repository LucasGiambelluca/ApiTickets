// Frontend Components for Ticketera

// Show Details Component
class ShowDetailsComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    async render(showId) {
        try {
            const show = await showsApi.getShow(showId);
            const seats = await showsApi.getShowSeats(showId);
            
            this.container.innerHTML = `
                <div class="show-details">
                    <h2>${show.event_name}</h2>
                    <div class="show-info">
                        <p><strong>Fecha:</strong> ${formatDate(show.starts_at)}</p>
                        <p><strong>Estado:</strong> ${show.status}</p>
                    </div>
                    <div class="seats-grid" id="seatsGrid">
                        ${this.renderSeats(seats)}
                    </div>
                    <div class="show-actions">
                        <button class="btn btn-primary" onclick="joinQueue(${showId})">
                            Unirse a la Cola
                        </button>
                    </div>
                </div>
            `;
        } catch (error) {
            this.container.innerHTML = `<div class="error">Error cargando show: ${error.message}</div>`;
        }
    }

    renderSeats(seats) {
        return seats.map(seat => `
            <div class="seat ${seat.status.toLowerCase()}" 
                 data-seat-id="${seat.id}"
                 onclick="selectSeat(${seat.id})">
                ${seat.sector}-${seat.row_label}${seat.seat_number}
            </div>
        `).join('');
    }
}

// Queue Component
class QueueComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pollInterval = null;
    }

    async render(showId, userId) {
        this.showId = showId;
        this.userId = userId;
        
        this.container.innerHTML = `
            <div class="queue-status">
                <h3>Cola Virtual</h3>
                <div class="queue-info" id="queueInfo">
                    <div class="spinner"></div>
                    <p>Obteniendo posición...</p>
                </div>
                <div class="queue-actions">
                    <button class="btn btn-secondary" onclick="leaveQueue()">
                        Salir de la Cola
                    </button>
                </div>
            </div>
        `;
        
        this.startPolling();
    }

    async startPolling() {
        this.pollInterval = setInterval(async () => {
            try {
                const position = await queueApi.getQueuePosition(this.showId, this.userId);
                this.updateQueueInfo(position);
            } catch (error) {
                console.error('Error polling queue:', error);
            }
        }, 3000);
    }

    updateQueueInfo(position) {
        const queueInfo = document.getElementById('queueInfo');
        if (position.position === 0) {
            queueInfo.innerHTML = `
                <div class="queue-ready">
                    <i class="fas fa-check-circle"></i>
                    <h4>¡Es tu turno!</h4>
                    <p>Puedes seleccionar tus asientos ahora</p>
                </div>
            `;
            this.stopPolling();
        } else {
            queueInfo.innerHTML = `
                <div class="queue-waiting">
                    <i class="fas fa-clock"></i>
                    <h4>Posición en cola: ${position.position}</h4>
                    <p>Tiempo estimado: ${position.estimatedWaitTime || 'Calculando...'}</p>
                </div>
            `;
        }
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
}

// Producers Management Component
class ProducersComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    async render() {
        this.container.innerHTML = `
            <div class="producers-management">
                <div class="section-header">
                    <h3>Gestión de Productores</h3>
                    <button class="btn btn-primary" onclick="showCreateProducerForm()">
                        <i class="fas fa-plus"></i> Nuevo Productor
                    </button>
                </div>
                <div id="producersList" class="producers-list">
                    <div class="spinner"></div>
                </div>
                <div id="producerForm" class="producer-form" style="display: none;">
                    ${this.renderProducerForm()}
                </div>
            </div>
        `;
        
        await this.loadProducers();
    }

    async loadProducers() {
        try {
            const producers = await producersApi.getProducers();
            this.renderProducersList(producers);
        } catch (error) {
            document.getElementById('producersList').innerHTML = 
                `<div class="error">Error cargando productores: ${error.message}</div>`;
        }
    }

    renderProducersList(producers) {
        const listContainer = document.getElementById('producersList');
        
        if (producers.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-tie"></i>
                    <h4>No hay productores registrados</h4>
                    <p>Crea el primer productor para comenzar</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = producers.map(producer => `
            <div class="producer-card">
                <div class="producer-info">
                    <h4>${producer.name}</h4>
                    <p><i class="fas fa-envelope"></i> ${producer.email}</p>
                    <p><i class="fas fa-phone"></i> ${producer.phone || 'Sin teléfono'}</p>
                </div>
                <div class="producer-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editProducer(${producer.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProducer(${producer.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderProducerForm(producer = null) {
        return `
            <form id="producerFormElement" class="config-form">
                <h4>${producer ? 'Editar' : 'Crear'} Productor</h4>
                <div class="form-group">
                    <label for="producerName">Nombre:</label>
                    <input type="text" id="producerName" required 
                           value="${producer?.name || ''}" placeholder="Nombre del productor">
                </div>
                <div class="form-group">
                    <label for="producerEmail">Email:</label>
                    <input type="email" id="producerEmail" required 
                           value="${producer?.email || ''}" placeholder="email@ejemplo.com">
                </div>
                <div class="form-group">
                    <label for="producerPhone">Teléfono:</label>
                    <input type="tel" id="producerPhone" 
                           value="${producer?.phone || ''}" placeholder="+54 11 1234-5678">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        ${producer ? 'Actualizar' : 'Crear'} Productor
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="hideProducerForm()">
                        Cancelar
                    </button>
                </div>
            </form>
        `;
    }
}

// Venues Management Component
class VenuesComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    async render() {
        this.container.innerHTML = `
            <div class="venues-management">
                <div class="section-header">
                    <h3>Gestión de Venues</h3>
                    <button class="btn btn-primary" onclick="showCreateVenueForm()">
                        <i class="fas fa-plus"></i> Nuevo Venue
                    </button>
                </div>
                <div id="venuesList" class="venues-list">
                    <div class="spinner"></div>
                </div>
                <div id="venueForm" class="venue-form" style="display: none;">
                    ${this.renderVenueForm()}
                </div>
            </div>
        `;
        
        await this.loadVenues();
    }

    async loadVenues() {
        try {
            const venues = await venuesApi.getVenues();
            this.renderVenuesList(venues);
        } catch (error) {
            document.getElementById('venuesList').innerHTML = 
                `<div class="error">Error cargando venues: ${error.message}</div>`;
        }
    }

    renderVenuesList(venues) {
        const listContainer = document.getElementById('venuesList');
        
        if (venues.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-building"></i>
                    <h4>No hay venues registrados</h4>
                    <p>Crea el primer venue para comenzar</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = venues.map(venue => `
            <div class="venue-card">
                <div class="venue-info">
                    <h4>${venue.name}</h4>
                    <p><i class="fas fa-map-marker-alt"></i> ${venue.address}</p>
                    <p><i class="fas fa-users"></i> Capacidad: ${venue.capacity}</p>
                </div>
                <div class="venue-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editVenue(${venue.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteVenue(${venue.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderVenueForm(venue = null) {
        return `
            <form id="venueFormElement" class="config-form">
                <h4>${venue ? 'Editar' : 'Crear'} Venue</h4>
                <div class="form-group">
                    <label for="venueName">Nombre:</label>
                    <input type="text" id="venueName" required 
                           value="${venue?.name || ''}" placeholder="Nombre del venue">
                </div>
                <div class="form-group">
                    <label for="venueAddress">Dirección:</label>
                    <input type="text" id="venueAddress" required 
                           value="${venue?.address || ''}" placeholder="Dirección completa">
                </div>
                <div class="form-group">
                    <label for="venueCapacity">Capacidad:</label>
                    <input type="number" id="venueCapacity" required min="1"
                           value="${venue?.capacity || ''}" placeholder="Capacidad máxima">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        ${venue ? 'Actualizar' : 'Crear'} Venue
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="hideVenueForm()">
                        Cancelar
                    </button>
                </div>
            </form>
        `;
    }
}

// Orders Management Component
class OrdersComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    async render() {
        this.container.innerHTML = `
            <div class="orders-management">
                <div class="section-header">
                    <h3>Gestión de Órdenes</h3>
                    <div class="filters">
                        <select id="orderStatusFilter">
                            <option value="">Todos los estados</option>
                            <option value="PENDING">Pendiente</option>
                            <option value="PAID">Pagado</option>
                            <option value="CANCELLED">Cancelado</option>
                        </select>
                    </div>
                </div>
                <div id="ordersList" class="orders-list">
                    <div class="spinner"></div>
                </div>
                <div id="ordersPagination" class="pagination"></div>
            </div>
        `;
        
        await this.loadOrders();
        this.initFilters();
    }

    async loadOrders(params = {}) {
        try {
            const response = await ordersApi.getOrders(params);
            this.renderOrdersList(response.orders);
            this.renderPagination(response.pagination);
        } catch (error) {
            document.getElementById('ordersList').innerHTML = 
                `<div class="error">Error cargando órdenes: ${error.message}</div>`;
        }
    }

    renderOrdersList(orders) {
        const listContainer = document.getElementById('ordersList');
        
        if (orders.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <h4>No hay órdenes</h4>
                    <p>Las órdenes aparecerán aquí cuando se realicen compras</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-header">
                    <h4>Orden #${order.id}</h4>
                    <span class="order-status status-${order.status.toLowerCase()}">${order.status}</span>
                </div>
                <div class="order-info">
                    <p><strong>Usuario:</strong> ${order.user_email || order.user_id}</p>
                    <p><strong>Total:</strong> $${(order.total_cents / 100).toFixed(2)}</p>
                    <p><strong>Fecha:</strong> ${formatDate(order.created_at)}</p>
                </div>
                <div class="order-actions">
                    <button class="btn btn-sm btn-primary" onclick="viewOrderDetails(${order.id})">
                        Ver Detalles
                    </button>
                </div>
            </div>
        `).join('');
    }

    initFilters() {
        const statusFilter = document.getElementById('orderStatusFilter');
        statusFilter.addEventListener('change', () => {
            const status = statusFilter.value;
            this.loadOrders(status ? { status } : {});
        });
    }
}

// Export components
window.ShowDetailsComponent = ShowDetailsComponent;
window.QueueComponent = QueueComponent;
window.ProducersComponent = ProducersComponent;
window.VenuesComponent = VenuesComponent;
window.OrdersComponent = OrdersComponent;
