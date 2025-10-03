const { pool } = require('../src/db');

// Reporte completo de un evento
exports.getEventReport = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const eventId = Number(req.params.eventId);
    
    // Información básica del evento
    const [[event]] = await conn.query(`
      SELECT 
        e.*,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city,
        v.max_capacity as venue_capacity,
        COUNT(DISTINCT s.id) as shows_count,
        MIN(s.starts_at) as first_show,
        MAX(s.starts_at) as last_show
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN shows s ON e.id = s.event_id
      WHERE e.id = ?
      GROUP BY e.id
    `, [eventId]);
    
    if (!event) {
      return res.status(404).json({
        error: 'EventNotFound',
        message: 'Evento no encontrado'
      });
    }
    
    // Resumen de ventas por tipo de ticket
    const [ticketSales] = await conn.query(`
      SELECT 
        tt.id,
        tt.name,
        tt.description,
        tt.price_cents,
        tt.quantity_total,
        tt.quantity_sold,
        tt.quantity_reserved,
        (tt.quantity_total - tt.quantity_sold - tt.quantity_reserved) as available,
        (tt.quantity_sold * tt.price_cents) as revenue_cents,
        ROUND((tt.quantity_sold * 100.0 / NULLIF(tt.quantity_total, 0)), 2) as sold_percentage
      FROM ticket_types tt
      WHERE tt.event_id = ? AND tt.is_active = TRUE
      ORDER BY tt.price_cents DESC
    `, [eventId]);
    
    // Estadísticas generales
    const totalTicketsAvailable = ticketSales.reduce((sum, t) => sum + t.quantity_total, 0);
    const totalTicketsSold = ticketSales.reduce((sum, t) => sum + t.quantity_sold, 0);
    const totalTicketsReserved = ticketSales.reduce((sum, t) => sum + t.quantity_reserved, 0);
    const totalRevenue = ticketSales.reduce((sum, t) => sum + t.revenue_cents, 0);
    
    // Ventas por día (últimos 30 días)
    const [dailySales] = await conn.query(`
      SELECT 
        DATE(tr.updated_at) as date,
        COUNT(*) as tickets_sold,
        SUM(tt.price_cents * tr.quantity) as revenue_cents,
        COUNT(DISTINCT tr.customer_email) as unique_customers
      FROM ticket_reservations tr
      JOIN ticket_types tt ON tr.ticket_type_id = tt.id
      WHERE tt.event_id = ? 
        AND tr.status = 'PURCHASED'
        AND tr.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(tr.updated_at)
      ORDER BY date ASC
    `, [eventId]);
    
    // Top compradores
    const [topCustomers] = await conn.query(`
      SELECT 
        tr.customer_name,
        tr.customer_email,
        COUNT(*) as reservations_count,
        SUM(tr.quantity) as total_tickets,
        SUM(tt.price_cents * tr.quantity) as total_spent_cents
      FROM ticket_reservations tr
      JOIN ticket_types tt ON tr.ticket_type_id = tt.id
      WHERE tt.event_id = ? AND tr.status = 'PURCHASED'
      GROUP BY tr.customer_email, tr.customer_name
      ORDER BY total_spent_cents DESC
      LIMIT 10
    `, [eventId]);
    
    // Análisis de precios
    const avgTicketPrice = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;
    const maxPrice = Math.max(...ticketSales.map(t => t.price_cents));
    const minPrice = Math.min(...ticketSales.map(t => t.price_cents));
    
    // Proyecciones (si hay tendencia)
    let projectedRevenue = totalRevenue;
    let projectedTickets = totalTicketsSold;
    
    if (dailySales.length >= 7) {
      const recentSales = dailySales.slice(-7);
      const avgDailyRevenue = recentSales.reduce((sum, day) => sum + day.revenue_cents, 0) / 7;
      const avgDailyTickets = recentSales.reduce((sum, day) => sum + day.tickets_sold, 0) / 7;
      
      const daysUntilEvent = event.first_show ? 
        Math.max(0, Math.ceil((new Date(event.first_show) - new Date()) / (1000 * 60 * 60 * 24))) : 0;
      
      if (daysUntilEvent > 0) {
        projectedRevenue = totalRevenue + (avgDailyRevenue * daysUntilEvent);
        projectedTickets = totalTicketsSold + (avgDailyTickets * daysUntilEvent);
      }
    }
    
    res.json({
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        venue: {
          name: event.venue_name,
          address: event.venue_address,
          city: event.venue_city,
          capacity: event.venue_capacity
        },
        shows: {
          count: event.shows_count,
          firstShow: event.first_show,
          lastShow: event.last_show
        },
        image_url: event.image_url,
        created_at: event.created_at
      },
      
      summary: {
        totalTicketsAvailable,
        totalTicketsSold,
        totalTicketsReserved,
        ticketsRemaining: totalTicketsAvailable - totalTicketsSold - totalTicketsReserved,
        totalRevenue,
        totalRevenueFormatted: (totalRevenue / 100).toFixed(2),
        occupancyRate: totalTicketsAvailable > 0 ? 
          ((totalTicketsSold / totalTicketsAvailable) * 100).toFixed(2) : 0,
        averageTicketPrice: (avgTicketPrice / 100).toFixed(2),
        uniqueCustomers: [...new Set(topCustomers.map(c => c.customer_email))].length
      },
      
      ticketTypes: ticketSales.map(ticket => ({
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        price: (ticket.price_cents / 100).toFixed(2),
        priceCents: ticket.price_cents,
        total: ticket.quantity_total,
        sold: ticket.quantity_sold,
        reserved: ticket.quantity_reserved,
        available: ticket.available,
        revenue: (ticket.revenue_cents / 100).toFixed(2),
        revenueCents: ticket.revenue_cents,
        soldPercentage: ticket.sold_percentage,
        revenueShare: totalRevenue > 0 ? 
          ((ticket.revenue_cents / totalRevenue) * 100).toFixed(2) : 0
      })),
      
      salesTimeline: dailySales.map(day => ({
        date: day.date,
        ticketsSold: day.tickets_sold,
        revenue: (day.revenue_cents / 100).toFixed(2),
        revenueCents: day.revenue_cents,
        uniqueCustomers: day.unique_customers
      })),
      
      topCustomers: topCustomers.map(customer => ({
        name: customer.customer_name,
        email: customer.customer_email,
        reservations: customer.reservations_count,
        totalTickets: customer.total_tickets,
        totalSpent: (customer.total_spent_cents / 100).toFixed(2),
        totalSpentCents: customer.total_spent_cents
      })),
      
      analytics: {
        priceAnalysis: {
          average: (avgTicketPrice / 100).toFixed(2),
          maximum: (maxPrice / 100).toFixed(2),
          minimum: (minPrice / 100).toFixed(2),
          range: ((maxPrice - minPrice) / 100).toFixed(2)
        },
        projections: {
          estimatedFinalRevenue: (projectedRevenue / 100).toFixed(2),
          estimatedFinalTickets: Math.round(projectedTickets),
          daysRemaining: event.first_show ? 
            Math.max(0, Math.ceil((new Date(event.first_show) - new Date()) / (1000 * 60 * 60 * 24))) : 0
        }
      },
      
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

// Reporte de todos los eventos (dashboard general)
exports.getAllEventsReport = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      sortBy = 'revenue',
      sortOrder = 'DESC',
      dateFrom,
      dateTo 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (dateFrom) {
      whereClause += ' AND e.created_at >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo) {
      whereClause += ' AND e.created_at <= ?';
      params.push(dateTo);
    }
    
    // Validar campos de ordenamiento
    const validSortFields = ['name', 'created_at', 'revenue', 'tickets_sold', 'occupancy'];
    const validSortOrders = ['ASC', 'DESC'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'revenue';
    const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    let orderByClause = '';
    switch (safeSortBy) {
      case 'revenue':
        orderByClause = 'total_revenue_cents';
        break;
      case 'tickets_sold':
        orderByClause = 'total_tickets_sold';
        break;
      case 'occupancy':
        orderByClause = 'occupancy_rate';
        break;
      default:
        orderByClause = `e.${safeSortBy}`;
    }
    
    const [events] = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.created_at,
        e.image_url,
        v.name as venue_name,
        v.city as venue_city,
        COUNT(DISTINCT s.id) as shows_count,
        MIN(s.starts_at) as first_show,
        MAX(s.starts_at) as last_show,
        COALESCE(SUM(tt.quantity_total), 0) as total_capacity,
        COALESCE(SUM(tt.quantity_sold), 0) as total_tickets_sold,
        COALESCE(SUM(tt.quantity_reserved), 0) as total_tickets_reserved,
        COALESCE(SUM(tt.quantity_sold * tt.price_cents), 0) as total_revenue_cents,
        CASE 
          WHEN SUM(tt.quantity_total) > 0 
          THEN ROUND((SUM(tt.quantity_sold) * 100.0 / SUM(tt.quantity_total)), 2)
          ELSE 0 
        END as occupancy_rate
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN shows s ON e.id = s.event_id
      LEFT JOIN ticket_types tt ON e.id = tt.event_id AND tt.is_active = TRUE
      ${whereClause}
      GROUP BY e.id, e.name, e.created_at, e.image_url, v.name, v.city
      ORDER BY ${orderByClause} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    // Contar total para paginación
    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT e.id) as total
      FROM events e
      LEFT JOIN shows s ON e.id = s.event_id
      ${whereClause}
    `, params);
    
    const total = countResult[0].total;
    
    // Estadísticas generales
    const [generalStats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT e.id) as total_events,
        COUNT(DISTINCT s.id) as total_shows,
        COALESCE(SUM(tt.quantity_sold), 0) as total_tickets_sold,
        COALESCE(SUM(tt.quantity_sold * tt.price_cents), 0) as total_revenue_cents,
        COUNT(DISTINCT tr.customer_email) as total_customers
      FROM events e
      LEFT JOIN shows s ON e.id = s.event_id
      LEFT JOIN ticket_types tt ON e.id = tt.event_id AND tt.is_active = TRUE
      LEFT JOIN ticket_reservations tr ON tt.id = tr.ticket_type_id AND tr.status = 'PURCHASED'
    `);
    
    res.json({
      events: events.map(event => ({
        id: event.id,
        name: event.name,
        venue: {
          name: event.venue_name,
          city: event.venue_city
        },
        shows: {
          count: event.shows_count,
          firstShow: event.first_show,
          lastShow: event.last_show
        },
        capacity: event.total_capacity,
        ticketsSold: event.total_tickets_sold,
        ticketsReserved: event.total_tickets_reserved,
        ticketsAvailable: event.total_capacity - event.total_tickets_sold - event.total_tickets_reserved,
        revenue: (event.total_revenue_cents / 100).toFixed(2),
        revenueCents: event.total_revenue_cents,
        occupancyRate: event.occupancy_rate,
        image_url: event.image_url,
        created_at: event.created_at
      })),
      
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      
      summary: {
        totalEvents: generalStats[0].total_events,
        totalShows: generalStats[0].total_shows,
        totalTicketsSold: generalStats[0].total_tickets_sold,
        totalRevenue: (generalStats[0].total_revenue_cents / 100).toFixed(2),
        totalRevenueCents: generalStats[0].total_revenue_cents,
        totalCustomers: generalStats[0].total_customers
      }
    });
    
  } catch (error) {
    throw error;
  }
};

// Reporte de ventas por período
exports.getSalesReport = async (req, res) => {
  try {
    const { 
      period = 'daily',
      dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dateTo = new Date().toISOString().split('T')[0],
      eventId
    } = req.query;
    
    let groupBy = '';
    let selectDate = '';
    
    switch (period) {
      case 'hourly':
        groupBy = 'DATE(tr.updated_at), HOUR(tr.updated_at)';
        selectDate = 'DATE(tr.updated_at) as date, HOUR(tr.updated_at) as hour';
        break;
      case 'weekly':
        groupBy = 'YEAR(tr.updated_at), WEEK(tr.updated_at)';
        selectDate = 'YEAR(tr.updated_at) as year, WEEK(tr.updated_at) as week';
        break;
      case 'monthly':
        groupBy = 'YEAR(tr.updated_at), MONTH(tr.updated_at)';
        selectDate = 'YEAR(tr.updated_at) as year, MONTH(tr.updated_at) as month';
        break;
      default: // daily
        groupBy = 'DATE(tr.updated_at)';
        selectDate = 'DATE(tr.updated_at) as date';
    }
    
    let whereClause = `WHERE tr.status = 'PURCHASED' 
                       AND DATE(tr.updated_at) >= ? 
                       AND DATE(tr.updated_at) <= ?`;
    const params = [dateFrom, dateTo];
    
    if (eventId) {
      whereClause += ' AND tt.event_id = ?';
      params.push(eventId);
    }
    
    const [salesData] = await pool.query(`
      SELECT 
        ${selectDate},
        COUNT(*) as transactions,
        SUM(tr.quantity) as tickets_sold,
        SUM(tt.price_cents * tr.quantity) as revenue_cents,
        COUNT(DISTINCT tr.customer_email) as unique_customers,
        COUNT(DISTINCT tt.event_id) as events_with_sales,
        AVG(tt.price_cents * tr.quantity) as avg_transaction_value
      FROM ticket_reservations tr
      JOIN ticket_types tt ON tr.ticket_type_id = tt.id
      ${whereClause}
      GROUP BY ${groupBy}
      ORDER BY ${groupBy}
    `, params);
    
    res.json({
      period,
      dateRange: {
        from: dateFrom,
        to: dateTo
      },
      eventId: eventId || null,
      data: salesData.map(item => ({
        ...item,
        revenue: (item.revenue_cents / 100).toFixed(2),
        avgTransactionValue: (item.avg_transaction_value / 100).toFixed(2)
      })),
      summary: {
        totalTransactions: salesData.reduce((sum, item) => sum + item.transactions, 0),
        totalTickets: salesData.reduce((sum, item) => sum + item.tickets_sold, 0),
        totalRevenue: (salesData.reduce((sum, item) => sum + item.revenue_cents, 0) / 100).toFixed(2),
        avgDailyRevenue: salesData.length > 0 ? 
          (salesData.reduce((sum, item) => sum + item.revenue_cents, 0) / salesData.length / 100).toFixed(2) : '0.00'
      }
    });
    
  } catch (error) {
    throw error;
  }
};

module.exports = exports;
