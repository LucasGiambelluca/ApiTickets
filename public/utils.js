// Utility functions for Ticketera Frontend

// Date formatting
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

function formatDateShort(dateString) {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Currency formatting
function formatCurrency(cents, currency = 'ARS') {
    const amount = cents / 100;
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

// Validation functions
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    return re.test(phone);
}

// Local storage helpers
const storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
    },
    
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }
};

// Session storage helpers
const sessionStorage = {
    set(key, value) {
        try {
            window.sessionStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving to sessionStorage:', error);
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from sessionStorage:', error);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            window.sessionStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing from sessionStorage:', error);
        }
    }
};

// Debounce function
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// URL helpers
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}

function removeQueryParam(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.pushState({}, '', url);
}

// Error handling
function handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    
    let message = 'Ha ocurrido un error inesperado';
    
    if (error.message) {
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            message = 'Error de conexión. Verifica tu conexión a internet.';
        } else if (error.message.includes('401')) {
            message = 'No tienes permisos para realizar esta acción.';
        } else if (error.message.includes('404')) {
            message = 'El recurso solicitado no fue encontrado.';
        } else if (error.message.includes('500')) {
            message = 'Error interno del servidor. Intenta más tarde.';
        } else {
            message = error.message;
        }
    }
    
    showToast(message, 'error');
    return message;
}

// Loading state management
const loadingManager = {
    activeRequests: new Set(),
    
    start(requestId) {
        this.activeRequests.add(requestId);
        this.updateUI();
    },
    
    end(requestId) {
        this.activeRequests.delete(requestId);
        this.updateUI();
    },
    
    updateUI() {
        const isLoading = this.activeRequests.size > 0;
        const overlay = document.getElementById('loadingOverlay');
        
        if (overlay) {
            if (isLoading) {
                overlay.classList.add('show');
            } else {
                overlay.classList.remove('show');
            }
        }
    }
};

// Form helpers
function getFormData(formElement) {
    const formData = new FormData(formElement);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        // Handle multiple values for same key (checkboxes, etc.)
        if (data[key]) {
            if (Array.isArray(data[key])) {
                data[key].push(value);
            } else {
                data[key] = [data[key], value];
            }
        } else {
            data[key] = value;
        }
    }
    
    return data;
}

function resetForm(formElement) {
    formElement.reset();
    
    // Clear any custom validation messages
    const inputs = formElement.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.classList.remove('error', 'success');
        const errorMsg = input.parentNode.querySelector('.error-message');
        if (errorMsg) {
            errorMsg.remove();
        }
    });
}

function validateForm(formElement, rules) {
    let isValid = true;
    const data = getFormData(formElement);
    
    // Clear previous validation messages
    formElement.querySelectorAll('.error-message').forEach(msg => msg.remove());
    formElement.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    
    for (const [field, fieldRules] of Object.entries(rules)) {
        const input = formElement.querySelector(`[name="${field}"]`);
        const value = data[field];
        
        for (const rule of fieldRules) {
            if (!rule.validate(value)) {
                isValid = false;
                
                if (input) {
                    input.classList.add('error');
                    
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'error-message';
                    errorMsg.textContent = rule.message;
                    input.parentNode.appendChild(errorMsg);
                }
                
                break; // Stop at first validation error for this field
            }
        }
    }
    
    return isValid;
}

// Common validation rules
const validationRules = {
    required: (message = 'Este campo es requerido') => ({
        validate: (value) => value && value.toString().trim() !== '',
        message
    }),
    
    email: (message = 'Ingresa un email válido') => ({
        validate: (value) => !value || validateEmail(value),
        message
    }),
    
    phone: (message = 'Ingresa un teléfono válido') => ({
        validate: (value) => !value || validatePhone(value),
        message
    }),
    
    minLength: (min, message) => ({
        validate: (value) => !value || value.toString().length >= min,
        message: message || `Debe tener al menos ${min} caracteres`
    }),
    
    maxLength: (max, message) => ({
        validate: (value) => !value || value.toString().length <= max,
        message: message || `No puede tener más de ${max} caracteres`
    }),
    
    min: (min, message) => ({
        validate: (value) => !value || Number(value) >= min,
        message: message || `El valor mínimo es ${min}`
    }),
    
    max: (max, message) => ({
        validate: (value) => !value || Number(value) <= max,
        message: message || `El valor máximo es ${max}`
    })
};

// Export utilities
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;
window.formatCurrency = formatCurrency;
window.validateEmail = validateEmail;
window.validatePhone = validatePhone;
window.storage = storage;
window.sessionStorage = sessionStorage;
window.debounce = debounce;
window.throttle = throttle;
window.getQueryParam = getQueryParam;
window.setQueryParam = setQueryParam;
window.removeQueryParam = removeQueryParam;
window.handleApiError = handleApiError;
window.loadingManager = loadingManager;
window.getFormData = getFormData;
window.resetForm = resetForm;
window.validateForm = validateForm;
window.validationRules = validationRules;
