// Application State
let currentPage = 1;
let currentFilters = {
    search: '',
    status: 'active',
    sortBy: 'created_at',
    sortOrder: 'DESC'
};

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const toastContainer = document.getElementById('toastContainer');

// Utility Functions
function showLoading() {
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Show target section
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // Load section content
            loadSectionContent(targetId);
        });
    });
}

function loadSectionContent(sectionId) {
    switch (sectionId) {
        case 'home':
            loadFeaturedEvents();
            break;
        case 'events':
            loadAllEvents();
            break;
        case 'admin':
            loadAdminContent();
            break;
    }
}

// Search Functionality
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await eventsApi.searchEvents(query);
                displaySearchResults(response.events);
            } catch (error) {
                console.error('Search error:', error);
                searchResults.style.display = 'none';
            }
        }, 300);
    });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function displaySearchResults(events) {
    const searchResults = document.getElementById('searchResults');
    
    if (events.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No se encontraron eventos</div>';
    } else {
        searchResults.innerHTML = events.map(event => `
            <div class="search-result-item" onclick="selectEvent(${event.id})">
                <strong>${event.name}</strong>
                <div style="font-size: 0.9rem; color: #666;">
                    ${event.show_count} show(s) - Próximo: ${formatDate(event.next_show_date)}
                </div>
            </div>
        `).join('');
    }
    
    searchResults.style.display = 'block';
}

function selectEvent(eventId) {
    document.getElementById('searchResults').style.display = 'none';
    showToast(`Evento seleccionado: ${eventId}`, 'info');
    // Here you would typically navigate to event details
}

// Events Loading
async function loadFeaturedEvents() {
    try {
        showLoading();
        const response = await eventsApi.getEvents({ limit: 6, status: 'active' });
        displayEvents(response.events, 'featuredEvents');
    } catch (error) {
        console.error('Error loading featured events:', error);
        showToast('Error al cargar eventos destacados', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAllEvents() {
    try {
        showLoading();
        const response = await eventsApi.getEvents({
            page: currentPage,
            limit: 12,
            ...currentFilters
        });
        
        displayEvents(response.events, 'allEvents');
        displayPagination(response.pagination);
    } catch (error) {
        console.error('Error loading events:', error);
        showToast('Error al cargar eventos', 'error');
        document.getElementById('allEvents').innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar eventos</h3><p>Por favor, intenta de nuevo más tarde.</p></div>';
    } finally {
        hideLoading();
    }
}

function displayEvents(events, containerId) {
    const container = document.getElementById(containerId);
    
    if (events.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>No hay eventos disponibles</h3>
                <p>No se encontraron eventos que coincidan con los criterios de búsqueda.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = events.map(event => renderEventCard(event)).join('');
}

function displayPagination(pagination) {
    const container = document.getElementById('pagination');
    
    if (pagination.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button ${pagination.page === 1 ? 'disabled' : ''} onclick="changePage(${pagination.page - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.totalPages, pagination.page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span>...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="${i === pagination.page ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }
    
    if (endPage < pagination.totalPages) {
        if (endPage < pagination.totalPages - 1) {
            paginationHTML += `<span>...</span>`;
        }
        paginationHTML += `<button onclick="changePage(${pagination.totalPages})">${pagination.totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button ${pagination.page === pagination.totalPages ? 'disabled' : ''} onclick="changePage(${pagination.page + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    container.innerHTML = paginationHTML;
}

function changePage(page) {
    currentPage = page;
    loadAllEvents();
}

function viewEventDetails(eventId) {
    showToast(`Ver detalles del evento ${eventId}`, 'info');
    // Here you would typically show event details modal or navigate to details page
}

// Filters
function initFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const sortByFilter = document.getElementById('sortBy');
    const sortOrderFilter = document.getElementById('sortOrder');
    
    [statusFilter, sortByFilter, sortOrderFilter].forEach(filter => {
        filter.addEventListener('change', () => {
            currentFilters = {
                status: statusFilter.value,
                sortBy: sortByFilter.value,
                sortOrder: sortOrderFilter.value
            };
            currentPage = 1;
            loadAllEvents();
        });
    });
}

// Admin Panel
function initAdminPanel() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            
            // Show target tab content
            tabContents.forEach(c => c.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });
    
    // Initialize forms
    initMercadoPagoForm();
    initFeesForm();
    initCreateEventForm();
}

async function loadAdminContent() {
    await loadMercadoPagoStatus();
    await loadFeesSettings();
}

// MercadoPago Configuration
async function loadMercadoPagoStatus() {
    try {
        const settings = await adminApi.getMercadoPagoSettings();
        displayMercadoPagoStatus(settings);
        
        // Fill form with current values
        if (settings.publicKey) {
            document.getElementById('publicKey').value = settings.publicKey;
        }
        if (settings.collectorId) {
            document.getElementById('collectorId').value = settings.collectorId;
        }
    } catch (error) {
        console.error('Error loading MercadoPago settings:', error);
        displayMercadoPagoStatus({ isConfigured: false, error: error.message });
    }
}

function displayMercadoPagoStatus(settings) {
    const statusContainer = document.getElementById('mpStatus');
    
    if (settings.isConfigured) {
        statusContainer.innerHTML = `
            <div class="config-status success">
                <i class="fas fa-check-circle"></i>
                <strong>MercadoPago configurado correctamente</strong>
                <div style="margin-top: 0.5rem; font-size: 0.9rem;">
                    Access Token: ${settings.accessToken}<br>
                    Public Key: ${settings.publicKey}<br>
                    ${settings.collectorId ? `Collector ID: ${settings.collectorId}` : ''}
                </div>
            </div>
        `;
    } else {
        statusContainer.innerHTML = `
            <div class="config-status warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>MercadoPago no configurado</strong>
                <div style="margin-top: 0.5rem;">
                    Configura las credenciales de MercadoPago para habilitar los pagos.
                </div>
            </div>
        `;
    }
}

function initMercadoPagoForm() {
    const form = document.getElementById('mpConfigForm');
    const testButton = document.getElementById('testConnection');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const settings = {
            accessToken: document.getElementById('accessToken').value,
            publicKey: document.getElementById('publicKey').value,
            collectorId: document.getElementById('collectorId').value
        };
        
        try {
            showLoading();
            await adminApi.setMercadoPagoSettings(settings);
            showToast('Configuración de MercadoPago guardada exitosamente', 'success');
            await loadMercadoPagoStatus();
        } catch (error) {
            console.error('Error saving MercadoPago settings:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });
    
    testButton.addEventListener('click', async () => {
        try {
            showLoading();
            const result = await adminApi.testMercadoPagoConnection();
            showToast(result.message, 'success');
        } catch (error) {
            console.error('Error testing MercadoPago connection:', error);
            showToast(`Error en la conexión: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });
}

// Fees Configuration
async function loadFeesSettings() {
    try {
        const settings = await adminApi.getFixedFee();
        document.getElementById('fixedFee').value = settings.fixedFeeCents;
    } catch (error) {
        console.error('Error loading fees settings:', error);
    }
}

function initFeesForm() {
    const form = document.getElementById('feesForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fixedFeeCents = parseInt(document.getElementById('fixedFee').value) || 0;
        
        try {
            showLoading();
            await adminApi.setFixedFee(fixedFeeCents);
            showToast('Configuración de tarifas guardada exitosamente', 'success');
        } catch (error) {
            console.error('Error saving fees settings:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });
}

// Image Preview Functionality
function initImagePreview() {
    const imageInput = document.getElementById('eventImage');
    const imagePreview = document.getElementById('imagePreview');
    
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <div class="remove-image" onclick="removeImagePreview()">
                            <i class="fas fa-times"></i> Quitar imagen
                        </div>
                    `;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function removeImagePreview() {
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('eventImage').value = '';
}

// Venue Management
async function loadVenues() {
    try {
        const response = await venuesApi.getVenues({ limit: 100 });
        const venueSelect = document.getElementById('venueSelect');
        
        if (venueSelect) {
            venueSelect.innerHTML = '<option value="">Seleccionar venue existente...</option>';
            response.venues.forEach(venue => {
                const option = document.createElement('option');
                option.value = venue.id;
                option.textContent = `${venue.name} - ${venue.city} (Cap: ${venue.max_capacity})`;
                venueSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading venues:', error);
    }
}

function initVenueSelector() {
    const createVenueBtn = document.getElementById('createVenueBtn');
    const cancelVenueBtn = document.getElementById('cancelVenueBtn');
    
    if (createVenueBtn) {
        createVenueBtn.addEventListener('click', () => {
            // Switch to create venue tab
            switchTab('create-venue');
        });
    }
    
    if (cancelVenueBtn) {
        cancelVenueBtn.addEventListener('click', () => {
            // Switch back to create event tab
            switchTab('create-event');
        });
    }
}

function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

// Create Venue Form
function initCreateVenueForm() {
    const form = document.getElementById('createVenueForm');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const venueData = {
                name: document.getElementById('venueName').value,
                address: document.getElementById('venueAddress').value,
                city: document.getElementById('venueCity').value,
                state: document.getElementById('venueState').value || null,
                country: document.getElementById('venueCountry').value || 'Argentina',
                postal_code: document.getElementById('venuePostalCode').value || null,
                latitude: document.getElementById('venueLatitude').value || null,
                longitude: document.getElementById('venueLongitude').value || null,
                max_capacity: parseInt(document.getElementById('venueCapacity').value),
                description: document.getElementById('venueDescription').value || null,
                phone: document.getElementById('venuePhone').value || null,
                email: document.getElementById('venueEmail').value || null,
                website: document.getElementById('venueWebsite').value || null
            };
            
            try {
                showLoading();
                const result = await venuesApi.createVenue(venueData);
                showToast(`Venue "${result.name}" creado exitosamente`, 'success');
                form.reset();
                
                // Reload venues in selector
                await loadVenues();
                
                // Switch back to create event tab
                switchTab('create-event');
                
                // Select the newly created venue
                const venueSelect = document.getElementById('venueSelect');
                if (venueSelect) {
                    venueSelect.value = result.id;
                }
            } catch (error) {
                console.error('Error creating venue:', error);
                showToast(`Error al crear venue: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
        });
    }
}

// Create Event Form (Updated)
function initCreateEventForm() {
    const form = document.getElementById('createEventForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('name', document.getElementById('eventName').value);
        formData.append('startsAt', document.getElementById('startsAt').value);
        
        const description = document.getElementById('eventDescription').value;
        if (description) {
            formData.append('description', description);
        }
        
        const venueSelect = document.getElementById('venueSelect');
        const venueInput = document.getElementById('venue');
        
        if (venueSelect.value) {
            formData.append('venue_id', venueSelect.value);
        } else if (venueInput.value) {
            formData.append('venue', venueInput.value);
        }
        
        const imageFile = document.getElementById('eventImage').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        try {
            showLoading();
            const result = await eventsApi.createEvent(formData);
            showToast(`Evento "${result.name}" creado exitosamente`, 'success');
            form.reset();
            removeImagePreview();
            
            // Refresh events if we're on the events page
            const activeSection = document.querySelector('.section.active');
            if (activeSection && activeSection.id === 'events') {
                loadAllEvents();
            }
        } catch (error) {
            console.error('Error creating event:', error);
            showToast(`Error al crear evento: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });
}

// Update event rendering to include images
function renderEventCard(event) {
    const imageHtml = event.image_url 
        ? `<img src="${event.image_url}" alt="${event.name}" class="event-image">`
        : `<div class="event-placeholder"><i class="fas fa-calendar-alt"></i></div>`;
    
    const venueInfo = event.venue_name 
        ? `${event.venue_name}${event.venue_city ? ` - ${event.venue_city}` : ''}`
        : event.venue || 'Venue por definir';
    
    return `
        <div class="event-card">
            ${imageHtml}
            <div class="event-content">
                <h3 class="event-title">${event.name}</h3>
                <div class="event-venue">
                    <i class="fas fa-map-marker-alt"></i> ${venueInfo}
                </div>
                <div class="event-date">
                    <i class="fas fa-clock"></i> ${formatDate(event.next_show_date)}
                </div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
            </div>
        </div>
    `;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSearch();
    initFilters();
    initAdminPanel();
    initImagePreview();
    initVenueSelector();
    initCreateVenueForm();
    
    // Load initial content
    loadFeaturedEvents();
    loadVenues();
    
    console.log('Ticketera Frontend initialized successfully');
});
