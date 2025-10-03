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

    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    }

    // POST request with FormData (for file uploads)
    async postFormData(endpoint, formData) {
        const url = `${this.baseURL}${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API FormData Request failed:', error);
            throw error;
        }
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Initialize API client
const api = new ApiClient(API_BASE_URL);

// Events API
const eventsApi = {
    // Get all events with pagination and filters
    async getEvents(params = {}) {
        return api.get('/events', params);
    },

    // Search events (quick search)
    async searchEvents(query, limit = 10) {
        return api.get('/events/search', { q: query, limit });
    },

    // Get event by ID
    async getEventById(id) {
        return api.get(`/events/${id}`);
    },

    // Create new event (with image support)
    async createEvent(formData) {
        return api.postFormData('/events', formData);
    },

    // Update event
    async updateEvent(id, formData) {
        return api.postFormData(`/events/${id}`, formData);
    },

    // Delete event
    async deleteEvent(id) {
        return api.delete(`/events/${id}`);
    }
};

// Venues API
const venuesApi = {
    // Get all venues with pagination and filters
    async getVenues(params = {}) {
        return api.get('/venues', params);
    },

    // Search venues (quick search)
    async searchVenues(query, limit = 10) {
        return api.get('/venues/search', { q: query, limit });
    },

    // Get venue by ID
    async getVenueById(id) {
        return api.get(`/venues/${id}`);
    },

    // Create new venue
    async createVenue(venueData) {
        return api.post('/venues', venueData);
    },

    // Update venue
    async updateVenue(id, venueData) {
        return api.put(`/venues/${id}`, venueData);
    },

    // Delete venue
    async deleteVenue(id) {
        return api.delete(`/venues/${id}`);
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
    }
};

// Health Check API
const healthApi = {
    async getStatus() {
        return api.get('/health');
    }
};

// Export APIs
window.eventsApi = eventsApi;
window.venuesApi = venuesApi;
window.adminApi = adminApi;
window.healthApi = healthApi;
