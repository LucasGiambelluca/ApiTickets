const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

class MercadoPagoService {
  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
      options: {
        timeout: 5000,
        idempotencyKey: 'abc'
      }
    });
    
    this.preference = new Preference(this.client);
    this.payment = new Payment(this.client);
  }

  // Crear preferencia de pago
  async createPreference(orderData) {
    try {
      const { orderId, items, payer, backUrls, metadata } = orderData;

      const preferenceData = {
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          quantity: item.quantity,
          currency_id: 'ARS',
          unit_price: item.unit_price / 100 // Convertir centavos a pesos
        })),
        payer: {
          name: payer.name,
          surname: payer.surname || '',
          email: payer.email,
          phone: payer.phone || {},
          identification: payer.identification || {},
          address: payer.address || {}
        },
        back_urls: {
          success: backUrls.success,
          failure: backUrls.failure,
          pending: backUrls.pending
        },
        auto_return: 'approved',
        external_reference: orderId.toString(),
        notification_url: `${process.env.BASE_URL}/api/payments/webhook`,
        metadata: {
          order_id: orderId,
          ...metadata
        },
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12
        }
      };

      const preference = await this.preference.create({ body: preferenceData });
      
      return {
        id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
        client_id: preference.client_id,
        collector_id: preference.collector_id,
        operation_type: preference.operation_type
      };
    } catch (error) {
      console.error('Error creating MercadoPago preference:', error);
      throw new Error('Error al crear preferencia de pago');
    }
  }

  // Obtener información de un pago
  async getPayment(paymentId) {
    try {
      const payment = await this.payment.get({ id: paymentId });
      return payment;
    } catch (error) {
      console.error('Error getting payment:', error);
      throw new Error('Error al obtener información del pago');
    }
  }

  // Procesar webhook de MercadoPago
  async processWebhook(body, headers) {
    try {
      const { type, data } = body;
      
      if (type === 'payment') {
        const paymentId = data.id;
        const payment = await this.getPayment(paymentId);
        
        return {
          type: 'payment',
          paymentId,
          status: payment.status,
          statusDetail: payment.status_detail,
          externalReference: payment.external_reference,
          transactionAmount: payment.transaction_amount,
          dateApproved: payment.date_approved,
          dateCreated: payment.date_created,
          paymentMethodId: payment.payment_method_id,
          paymentTypeId: payment.payment_type_id,
          payer: payment.payer
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error processing webhook:', error);
      throw new Error('Error al procesar webhook');
    }
  }

  // Crear pago directo (para testing)
  async createPayment(paymentData) {
    try {
      const payment = await this.payment.create({
        body: {
          transaction_amount: paymentData.transaction_amount,
          token: paymentData.token,
          description: paymentData.description,
          installments: paymentData.installments || 1,
          payment_method_id: paymentData.payment_method_id,
          issuer_id: paymentData.issuer_id,
          payer: {
            email: paymentData.payer.email,
            identification: paymentData.payer.identification
          },
          external_reference: paymentData.external_reference,
          metadata: paymentData.metadata || {}
        }
      });

      return payment;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw new Error('Error al crear pago');
    }
  }

  // Reembolsar pago
  async refundPayment(paymentId, amount = null) {
    try {
      const refundData = {
        payment_id: paymentId
      };
      
      if (amount) {
        refundData.amount = amount;
      }

      // MercadoPago SDK v2 maneja refunds diferente
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(refundData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const refund = await response.json();
      return refund;
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw new Error('Error al reembolsar pago');
    }
  }

  // Validar webhook signature (opcional, para mayor seguridad)
  validateWebhookSignature(body, signature) {
    // Implementar validación de firma si MercadoPago la proporciona
    // Por ahora retornamos true
    return true;
  }
}

module.exports = new MercadoPagoService();
