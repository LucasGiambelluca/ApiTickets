// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// API Client Class
class ApiClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    async post(endpoint, data = {}) {
        return this.request(endpoint, { method: 'POST', body: data });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, { method: 'PUT', body: data });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Initialize API client
const api = new ApiClient(API_BASE_URL);

// Events API
const eventsApi = {
    async getEvents(params = {}) {
        return api.get('/events', params);
    },
    async searchEvents(query, limit = 10) {
        return api.get('/events/search', { q: query, limit });
    },
    async createEvent(eventData) {
        return api.post('/events', eventData);
    }
};

// Shows API
const showsApi = {
    // Quick search shows
    async searchShows(query, limit = 10) {
        return api.get('/shows/search', { q: query, limit });
    },
    async getShow(showId) {
        return api.get(`/shows/${showId}`);
    },
    async getShowSeats(showId) {
        return api.get(`/shows/${showId}/seats`);
    },
    async createSection(showId, sectionData) {
        return api.post(`/shows/${showId}/sections`, sectionData);
    }
};

// Producers API
const producersApi = {
    // Quick search producers
    async searchProducers(query, limit = 10) {
        return api.get('/producers/search', { q: query, limit });
    },
    async getProducers(params = {}) {
        return api.get('/producers', params);
    },
    async createProducer(producerData) {
        return api.post('/producers', producerData);
    },
    async getProducer(producerId) {
        return api.get(`/producers/${producerId}`);
    },
    async updateProducer(producerId, producerData) {
        return api.put(`/producers/${producerId}`, producerData);
    },
    async deleteProducer(producerId) {
        return api.delete(`/producers/${producerId}`);
    }
};

// Venues API
const venuesApi = {
    async getVenues(params = {}) {
        return api.get('/venues', params);
    },
    async createVenue(venueData) {
        return api.post('/venues', venueData);
    },
    async getVenue(venueId) {
        return api.get(`/venues/${venueId}`);
    },
    async updateVenue(venueId, venueData) {
        return api.put(`/venues/${venueId}`, venueData);
    },
    async deleteVenue(venueId) {
        return api.delete(`/venues/${venueId}`);
    }
};

// Holds API
const holdsApi = {
    async createHold(showId, holdData) {
        return api.post(`/shows/${showId}/holds`, holdData);
    },
    async deleteHold(showId, holdId) {
        return api.delete(`/shows/${showId}/holds/${holdId}`);
    }
};

// Orders API
const ordersApi = {
    async createOrder(orderData) {
        return api.post('/orders', orderData);
    },
    async getOrder(orderId) {
        return api.get(`/orders/${orderId}`);
    },
    async getOrders(params = {}) {
        return api.get('/orders', params);
    }
};

// Queue API
const queueApi = {
    async joinQueue(showId, userId) {
        return api.post(`/queue/${showId}/join`, { userId });
    },
    async getQueuePosition(showId, userId) {
        return api.get(`/queue/${showId}/position`, { userId });
    },
    async processNext(showId) {
        return api.post(`/queue/${showId}/process-next`);
    },
    async getQueueStats(showId) {
        return api.get(`/queue/${showId}/stats`);
    }
};

// Payments API
const paymentsApi = {
    async createPreference(orderId) {
        return api.post('/payments/preference', { orderId });
    },
    async getPayment(paymentId) {
        return api.get(`/payments/${paymentId}`);
    },
    async refundPayment(paymentId, reason) {
        return api.post(`/payments/${paymentId}/refund`, { reason });
    }
};

// Admin API
const adminApi = {
    // Fixed Fee Settings
    async getFixedFee() {
        return api.get('/admin/settings/fixed-fee');
    },
    async setFixedFee(fixedFeeCents) {
        return api.put('/admin/settings/fixed-fee', { fixedFeeCents });
    },

    // MercadoPago Settings
    async getMercadoPagoSettings() {
        return api.get('/admin/settings/mercadopago');
    },
    async setMercadoPagoSettings(settings) {
        return api.put('/admin/settings/mercadopago', settings);
    },
    async testMercadoPagoConnection() {
        return api.post('/admin/settings/mercadopago/test');
    },

    // Users Management
    async getUsers(params = {}) {
        return api.get('/admin/users', params);
    },
    async createUser(userData) {
        return api.post('/admin/users', userData);
    },
    async updateUser(userId, userData) {
        return api.put(`/admin/users/${userId}`, userData);
    },
    async deleteUser(userId) {
        return api.delete(`/admin/users/${userId}`);
    }
};

// Health Check API
const healthApi = {
    async getStatus() {
        return api.get('/health');
    },
    async getApiHealth() {
        return api.get('/health');
    }
};

// Export all APIs
window.eventsApi = eventsApi;
window.showsApi = showsApi;
window.producersApi = producersApi;
window.venuesApi = venuesApi;
window.holdsApi = holdsApi;
window.ordersApi = ordersApi;
window.queueApi = queueApi;
window.paymentsApi = paymentsApi;
window.adminApi = adminApi;
window.healthApi = healthApi;
