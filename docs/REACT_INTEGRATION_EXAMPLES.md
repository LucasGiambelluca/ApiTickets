# Ejemplos de Integración con React - Ticketera API

## 🚀 Configuración Inicial

### API Client Setup
```javascript
// api/client.js
const API_BASE_URL = 'http://localhost:3000/api';

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    });
  }

  async postFormData(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} // No Content-Type para FormData
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

---

## 📅 EVENTOS - Ejemplos React

### Hook para Listar Eventos
```javascript
// hooks/useEvents.js
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export const useEvents = (filters = {}) => {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadEvents = async (newFilters = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: 1,
        limit: 12,
        status: 'active',
        sortBy: 'created_at',
        sortOrder: 'DESC',
        ...filters,
        ...newFilters
      };

      const response = await apiClient.get('/events', params);
      setEvents(response.events);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return {
    events,
    pagination,
    loading,
    error,
    loadEvents,
    refetch: () => loadEvents()
  };
};
```

### Componente Lista de Eventos
```javascript
// components/EventsList.jsx
import React from 'react';
import { useEvents } from '../hooks/useEvents';

const EventCard = ({ event }) => (
  <div className="event-card">
    {event.image_url ? (
      <img 
        src={`http://localhost:3000${event.image_url}`} 
        alt={event.name}
        className="event-image"
      />
    ) : (
      <div className="event-placeholder">
        📅
      </div>
    )}
    <div className="event-content">
      <h3>{event.name}</h3>
      <p className="venue">
        📍 {event.venue_name ? `${event.venue_name} - ${event.venue_city}` : event.venue}
      </p>
      <p className="date">
        🕒 {new Date(event.next_show_date).toLocaleDateString('es-ES')}
      </p>
      {event.description && (
        <p className="description">{event.description}</p>
      )}
    </div>
  </div>
);

const EventsList = () => {
  const { events, pagination, loading, error, loadEvents } = useEvents();

  const handlePageChange = (page) => {
    loadEvents({ page });
  };

  const handleSearch = (search) => {
    loadEvents({ search, page: 1 });
  };

  if (loading) return <div>Cargando eventos...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="events-container">
      <div className="events-grid">
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
      
      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => handlePageChange(i + 1)}
              className={pagination.page === i + 1 ? 'active' : ''}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsList;
```

### Componente Crear Evento
```javascript
// components/CreateEvent.jsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const CreateEvent = ({ onEventCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startsAt: '',
    venue: '',
    venue_id: ''
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar venues
  useEffect(() => {
    const loadVenues = async () => {
      try {
        const response = await apiClient.get('/venues', { limit: 100 });
        setVenues(response.venues);
      } catch (err) {
        console.error('Error loading venues:', err);
      }
    };
    loadVenues();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('startsAt', formData.startsAt);
      
      if (formData.description) {
        submitData.append('description', formData.description);
      }
      
      if (formData.venue_id) {
        submitData.append('venue_id', formData.venue_id);
      } else if (formData.venue) {
        submitData.append('venue', formData.venue);
      }
      
      if (image) {
        submitData.append('image', image);
      }

      const result = await apiClient.postFormData('/events', submitData);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        startsAt: '',
        venue: '',
        venue_id: ''
      });
      removeImage();
      
      if (onEventCreated) {
        onEventCreated(result);
      }
      
      alert(`Evento "${result.name}" creado exitosamente`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-event-form">
      <h2>Crear Nuevo Evento</h2>
      
      {error && <div className="error">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="name">Nombre del Evento *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Descripción</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows="3"
        />
      </div>

      <div className="form-group">
        <label htmlFor="image">Imagen del Evento</label>
        <input
          type="file"
          id="image"
          accept="image/*"
          onChange={handleImageChange}
        />
        {imagePreview && (
          <div className="image-preview">
            <img src={imagePreview} alt="Preview" style={{ maxWidth: '300px' }} />
            <button type="button" onClick={removeImage}>Quitar imagen</button>
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="startsAt">Fecha y Hora de Inicio *</label>
        <input
          type="datetime-local"
          id="startsAt"
          name="startsAt"
          value={formData.startsAt}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="venue_id">Venue</label>
        <select
          id="venue_id"
          name="venue_id"
          value={formData.venue_id}
          onChange={handleInputChange}
        >
          <option value="">Seleccionar venue existente...</option>
          {venues.map(venue => (
            <option key={venue.id} value={venue.id}>
              {venue.name} - {venue.city} (Cap: {venue.max_capacity})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="venue">O escribir venue manualmente</label>
        <input
          type="text"
          id="venue"
          name="venue"
          value={formData.venue}
          onChange={handleInputChange}
          placeholder="Nombre del venue"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear Evento'}
      </button>
    </form>
  );
};

export default CreateEvent;
```

---

## 🏢 VENUES - Ejemplos React

### Hook para Venues
```javascript
// hooks/useVenues.js
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export const useVenues = (filters = {}) => {
  const [venues, setVenues] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadVenues = async (newFilters = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'ASC',
        ...filters,
        ...newFilters
      };

      const response = await apiClient.get('/venues', params);
      setVenues(response.venues);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createVenue = async (venueData) => {
    try {
      setLoading(true);
      const result = await apiClient.post('/venues', venueData);
      await loadVenues(); // Recargar lista
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateVenue = async (id, venueData) => {
    try {
      setLoading(true);
      const result = await apiClient.put(`/venues/${id}`, venueData);
      await loadVenues(); // Recargar lista
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteVenue = async (id) => {
    try {
      setLoading(true);
      await apiClient.delete(`/venues/${id}`);
      await loadVenues(); // Recargar lista
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVenues();
  }, []);

  return {
    venues,
    pagination,
    loading,
    error,
    loadVenues,
    createVenue,
    updateVenue,
    deleteVenue
  };
};
```

### Componente Crear Venue
```javascript
// components/CreateVenue.jsx
import React, { useState } from 'react';

const CreateVenue = ({ onVenueCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: 'Argentina',
    postal_code: '',
    latitude: '',
    longitude: '',
    max_capacity: '',
    description: '',
    phone: '',
    email: '',
    website: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      // Preparar datos
      const venueData = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        max_capacity: parseInt(formData.max_capacity),
        state: formData.state || null,
        country: formData.country,
        postal_code: formData.postal_code || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        description: formData.description || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null
      };

      const result = await apiClient.post('/venues', venueData);
      
      // Reset form
      setFormData({
        name: '',
        address: '',
        city: '',
        state: '',
        country: 'Argentina',
        postal_code: '',
        latitude: '',
        longitude: '',
        max_capacity: '',
        description: '',
        phone: '',
        email: '',
        website: ''
      });
      
      if (onVenueCreated) {
        onVenueCreated(result);
      }
      
      alert(`Venue "${result.name}" creado exitosamente`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-venue-form">
      <h2>Crear Nuevo Venue</h2>
      
      {error && <div className="error">{error}</div>}
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="name">Nombre del Venue *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="max_capacity">Capacidad Máxima *</label>
          <input
            type="number"
            id="max_capacity"
            name="max_capacity"
            value={formData.max_capacity}
            onChange={handleInputChange}
            min="1"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="address">Dirección *</label>
        <input
          type="text"
          id="address"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="city">Ciudad *</label>
          <input
            type="text"
            id="city"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="state">Provincia/Estado</label>
          <input
            type="text"
            id="state"
            name="state"
            value={formData.state}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="latitude">Latitud</label>
          <input
            type="number"
            id="latitude"
            name="latitude"
            value={formData.latitude}
            onChange={handleInputChange}
            step="any"
            placeholder="-34.6037"
          />
        </div>
        <div className="form-group">
          <label htmlFor="longitude">Longitud</label>
          <input
            type="number"
            id="longitude"
            name="longitude"
            value={formData.longitude}
            onChange={handleInputChange}
            step="any"
            placeholder="-58.3816"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description">Descripción</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows="3"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="phone">Teléfono</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="website">Sitio Web</label>
        <input
          type="url"
          id="website"
          name="website"
          value={formData.website}
          onChange={handleInputChange}
          placeholder="https://ejemplo.com"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear Venue'}
      </button>
    </form>
  );
};

export default CreateVenue;
```

---

## 🔍 BÚSQUEDA - Ejemplos React

### Componente de Búsqueda con Autocomplete
```javascript
// components/SearchEvents.jsx
import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';

const SearchEvents = ({ onEventSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const searchEvents = async () => {
      if (query.length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.get('/events/search', { q: query });
        setResults(response.events);
        setShowResults(true);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchEvents, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleEventSelect = (event) => {
    setQuery(event.name);
    setShowResults(false);
    if (onEventSelect) {
      onEventSelect(event);
    }
  };

  return (
    <div className="search-container" ref={searchRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar eventos..."
        className="search-input"
      />
      
      {showResults && (
        <div className="search-results">
          {loading && <div className="search-loading">Buscando...</div>}
          
          {!loading && results.length === 0 && (
            <div className="search-no-results">No se encontraron eventos</div>
          )}
          
          {!loading && results.map(event => (
            <div
              key={event.id}
              className="search-result-item"
              onClick={() => handleEventSelect(event)}
            >
              <div className="result-name">{event.name}</div>
              <div className="result-details">
                {event.venue_name && (
                  <span>📍 {event.venue_name} - {event.venue_city}</span>
                )}
                <span>🕒 {new Date(event.next_show_date).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchEvents;
```

---

## ⚙️ CONFIGURACIÓN - Ejemplos React

### Hook para Configuración de MercadoPago
```javascript
// hooks/useMercadoPago.js
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export const useMercadoPago = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/settings/mercadopago');
      setConfig(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (credentials) => {
    try {
      setLoading(true);
      await apiClient.put('/admin/settings/mercadopago', credentials);
      await loadConfig(); // Recargar configuración
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post('/admin/settings/mercadopago/test');
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return {
    config,
    loading,
    error,
    saveConfig,
    testConnection,
    refetch: loadConfig
  };
};
```

---

## 🎨 CSS Sugerido

```css
/* Estilos básicos para los componentes */
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}

.event-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.event-card:hover {
  transform: translateY(-2px);
}

.event-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.event-placeholder {
  width: 100%;
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: white;
}

.event-content {
  padding: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-container {
  position: relative;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
}

.search-result-item {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.search-result-item:hover {
  background-color: #f5f5f5;
}

.error {
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 2rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
}

.pagination button.active {
  background: #007bff;
  color: white;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Estos ejemplos te proporcionan una base sólida para integrar la API de Ticketera con React. Puedes adaptarlos según tus necesidades específicas y el diseño de tu aplicación.
