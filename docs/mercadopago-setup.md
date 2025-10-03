# 💳 Configuración de MercadoPago

## 1. Crear Cuenta de Desarrollador

1. Ve a [MercadoPago Developers](https://developers.mercadopago.com)
2. Crea una cuenta o inicia sesión
3. Ve a "Mis aplicaciones" > "Crear aplicación"

## 2. Obtener Credenciales

### Credenciales de Prueba (Sandbox)
```bash
# En tu .env
MP_ACCESS_TOKEN=TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789
MP_PUBLIC_KEY=TEST-abcdef12-3456-7890-abcd-ef1234567890
```

### Credenciales de Producción
```bash
# En tu .env de producción
MP_ACCESS_TOKEN=APP_USR-1234567890-123456-abcdef1234567890abcdef1234567890-123456789
MP_PUBLIC_KEY=APP_USR-abcdef12-3456-7890-abcd-ef1234567890
```

## 3. Configurar Webhook

### URL del Webhook
```
https://tu-dominio.com/api/payments/webhook
```

### Eventos a Suscribir
- ✅ `payment` - Notificaciones de pago

### Configuración en MercadoPago
1. Ve a tu aplicación en el panel de MercadoPago
2. Sección "Webhooks"
3. Agregar nueva URL
4. Seleccionar eventos de `payment`

## 4. URLs de Retorno

Configura estas URLs en tu frontend:

```javascript
const backUrls = {
  success: "https://tu-frontend.com/payment/success",
  failure: "https://tu-frontend.com/payment/failure", 
  pending: "https://tu-frontend.com/payment/pending"
};
```

## 5. Tarjetas de Prueba

### Visa (Aprobada)
```
Número: 4509 9535 6623 3704
CVV: 123
Fecha: 11/25
Nombre: APRO
```

### Mastercard (Rechazada)
```
Número: 5031 7557 3453 0604
CVV: 123
Fecha: 11/25
Nombre: OTHE
```

### American Express (Pendiente)
```
Número: 3711 803032 57522
CVV: 1234
Fecha: 11/25
Nombre: CONT
```

## 6. Usuarios de Prueba

### Comprador
```
Email: test_user_123456@testuser.com
Password: qatest123
```

### Vendedor
```
Email: test_user_789012@testuser.com
Password: qatest123
```

## 7. Flujo de Integración

### Paso 1: Crear Preferencia
```javascript
const preference = await fetch('/api/payments/preference', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: 123,
    payer: {
      name: "Juan",
      surname: "Pérez", 
      email: "juan@example.com"
    },
    backUrls: {
      success: "https://yoursite.com/success",
      failure: "https://yoursite.com/failure",
      pending: "https://yoursite.com/pending"
    }
  })
});
```

### Paso 2: Redirigir al Checkout
```javascript
const { initPoint } = await preference.json();
window.location.href = initPoint; // Producción
// window.location.href = sandboxInitPoint; // Pruebas
```

### Paso 3: Manejar Webhook
El webhook se procesa automáticamente en `/api/payments/webhook`

### Paso 4: Verificar Estado
```javascript
const status = await fetch(`/api/payments/order/${orderId}/status`);
const { status: paymentStatus } = await status.json();
```

## 8. Estados de Pago

| Estado | Descripción |
|--------|-------------|
| `pending` | Pago pendiente |
| `approved` | Pago aprobado |
| `authorized` | Pago autorizado |
| `in_process` | Pago en proceso |
| `in_mediation` | Pago en mediación |
| `rejected` | Pago rechazado |
| `cancelled` | Pago cancelado |
| `refunded` | Pago reembolsado |
| `charged_back` | Contracargo |

## 9. Códigos de Error Comunes

| Código | Descripción | Solución |
|--------|-------------|----------|
| `cc_rejected_insufficient_amount` | Fondos insuficientes | Usar otra tarjeta |
| `cc_rejected_bad_filled_security_code` | CVV incorrecto | Verificar CVV |
| `cc_rejected_bad_filled_date` | Fecha inválida | Verificar fecha |
| `cc_rejected_bad_filled_other` | Datos incorrectos | Verificar datos |

## 10. Testing

### Probar Webhook Localmente
```bash
# Usar ngrok para exponer localhost
ngrok http 3000

# Configurar webhook con URL de ngrok
https://abc123.ngrok.io/api/payments/webhook
```

### Verificar Webhook
```bash
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": {
      "id": "123456789"
    }
  }'
```

## 11. Monitoreo

### Logs Importantes
- Creación de preferencias
- Procesamiento de webhooks  
- Errores de pago
- Reembolsos

### Métricas a Monitorear
- Tasa de conversión
- Pagos fallidos
- Tiempo de procesamiento
- Reembolsos

## 12. Seguridad

### Validaciones
- ✅ Verificar firma del webhook (si está disponible)
- ✅ Validar external_reference
- ✅ Verificar montos
- ✅ Usar HTTPS en producción

### Buenas Prácticas
- No exponer credenciales en el frontend
- Validar todos los datos del webhook
- Implementar idempotencia
- Manejar reintentos de webhook
