const { pool } = require('../src/db');
const axios = require('axios');

exports.getFixedFee = async (_req, res) => {
  const [[row]] = await pool.query("SELECT `value` FROM settings WHERE `key`='fixed_fee_cents' LIMIT 1");
  res.json({ fixedFeeCents: parseInt(row?.value || '0', 10) || 0 });
};

exports.setFixedFee = async (req, res) => {
  const { fixedFeeCents } = req.body || {};
  const value = Number.isFinite(+fixedFeeCents) ? String(parseInt(fixedFeeCents, 10)) : '0';
  await pool.query("INSERT INTO settings (`key`,`value`) VALUES ('fixed_fee_cents', ?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)", [value]);
  res.json({ ok: true, fixedFeeCents: parseInt(value, 10) });
};

// Obtener configuración de MercadoPago (sin exponer el access token completo)
exports.getMercadoPagoSettings = async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    const [accessTokenRow] = await conn.query("SELECT `value` FROM settings WHERE `key`='mp_access_token' LIMIT 1");
    const [publicKeyRow] = await conn.query("SELECT `value` FROM settings WHERE `key`='mp_public_key' LIMIT 1");
    const [collectorIdRow] = await conn.query("SELECT `value` FROM settings WHERE `key`='mp_collector_id' LIMIT 1");
    const [isConfiguredRow] = await conn.query("SELECT `value` FROM settings WHERE `key`='mp_configured' LIMIT 1");
    
    const accessToken = accessTokenRow[0]?.value || '';
    const publicKey = publicKeyRow[0]?.value || '';
    const collectorId = collectorIdRow[0]?.value || '';
    const isConfigured = isConfiguredRow[0]?.value === 'true';
    
    // Ocultar la mayor parte del access token por seguridad
    const maskedAccessToken = accessToken ? 
      `${accessToken.substring(0, 8)}${'*'.repeat(Math.max(0, accessToken.length - 12))}${accessToken.substring(accessToken.length - 4)}` : 
      '';
    
    res.json({
      accessToken: maskedAccessToken,
      publicKey,
      collectorId,
      isConfigured,
      hasAccessToken: !!accessToken
    });
  } finally {
    conn.release();
  }
};

// Configurar credenciales de MercadoPago
exports.setMercadoPagoSettings = async (req, res) => {
  const { accessToken, publicKey, collectorId } = req.body || {};
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Validar que el access token tenga el formato correcto
    if (!accessToken || !accessToken.startsWith('APP_USR-') && !accessToken.startsWith('TEST-')) {
      return res.status(400).json({ 
        error: 'Access token inválido. Debe comenzar con APP_USR- (producción) o TEST- (sandbox)' 
      });
    }
    
    // Validar que la public key tenga el formato correcto
    if (!publicKey || !publicKey.startsWith('APP_USR-') && !publicKey.startsWith('TEST-')) {
      return res.status(400).json({ 
        error: 'Public key inválida. Debe comenzar con APP_USR- (producción) o TEST- (sandbox)' 
      });
    }
    
    // Verificar que ambas credenciales sean del mismo entorno
    const isAccessTokenTest = accessToken.startsWith('TEST-');
    const isPublicKeyTest = publicKey.startsWith('TEST-');
    
    if (isAccessTokenTest !== isPublicKeyTest) {
      return res.status(400).json({ 
        error: 'Las credenciales deben ser del mismo entorno (ambas de TEST o ambas de producción)' 
      });
    }
    
    // Guardar configuración
    await conn.query(
      "INSERT INTO settings (`key`,`value`) VALUES ('mp_access_token', ?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)", 
      [accessToken]
    );
    
    await conn.query(
      "INSERT INTO settings (`key`,`value`) VALUES ('mp_public_key', ?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)", 
      [publicKey]
    );
    
    if (collectorId) {
      await conn.query(
        "INSERT INTO settings (`key`,`value`) VALUES ('mp_collector_id', ?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)", 
        [collectorId]
      );
    }
    
    await conn.query(
      "INSERT INTO settings (`key`,`value`) VALUES ('mp_configured', 'true') ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)"
    );
    
    // Determinar el entorno
    const environment = isAccessTokenTest ? 'sandbox' : 'production';
    await conn.query(
      "INSERT INTO settings (`key`,`value`) VALUES ('mp_environment', ?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)", 
      [environment]
    );
    
    await conn.commit();
    
    res.json({ 
      ok: true, 
      message: 'Configuración de MercadoPago guardada exitosamente',
      environment 
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
};

// Probar conexión con MercadoPago
exports.testMercadoPagoConnection = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [accessTokenRow] = await conn.query("SELECT `value` FROM settings WHERE `key`='mp_access_token' LIMIT 1");
    const accessToken = accessTokenRow[0]?.value;
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'No hay access token configurado' 
      });
    }
    
    // Probar la conexión con la API de MercadoPago
    const response = await axios.get('https://api.mercadopago.com/v1/account/settings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.status === 200) {
      const accountInfo = response.data;
      
      // Guardar información adicional si está disponible
      if (accountInfo.site_id) {
        await conn.query(
          "INSERT INTO settings (`key`,`value`) VALUES ('mp_site_id', ?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)", 
          [accountInfo.site_id]
        );
      }
      
      res.json({ 
        ok: true, 
        message: 'Conexión exitosa con MercadoPago',
        accountInfo: {
          siteId: accountInfo.site_id,
          countryId: accountInfo.country_id,
          categoryId: accountInfo.category_id
        }
      });
    } else {
      res.status(400).json({ 
        error: 'No se pudo conectar con MercadoPago',
        details: response.statusText 
      });
    }
  } catch (error) {
    console.error('Error testing MercadoPago connection:', error);
    
    if (error.response) {
      res.status(400).json({ 
        error: 'Error en la conexión con MercadoPago',
        details: error.response.data?.message || error.response.statusText,
        status: error.response.status
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ 
        error: 'Timeout en la conexión con MercadoPago' 
      });
    } else {
      res.status(500).json({ 
        error: 'Error interno al probar la conexión',
        details: error.message 
      });
    }
  } finally {
    conn.release();
  }
};
