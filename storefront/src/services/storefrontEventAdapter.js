/**
 * Storefront Event Adapter
 * Convert storefront orders/products → REA events
 * Cho phép storefront sử dụng cùng backend event system với ERP
 */

/**
 * Convert guest checkout order → sale event
 */
export function convertGuestCheckoutToSaleEvent(orderData) {
  return {
    eventType: 'sale',
    timestamp: new Date().toISOString(),
    data: {
      // Customer info
      customer_id: orderData.customerId || null,
      customer_name: orderData.customerName || 'Khách lẻ',
      customer_email: orderData.customerEmail || null,
      customer_phone: orderData.customerPhone || null,

      // Order info
      order_code: orderData.orderCode || `ORD-${Date.now()}`,
      order_date: orderData.orderDate || new Date().toISOString(),
      
      // Line items
      items: orderData.items?.map(item => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice,
        discount: item.discount || 0,
        tax: item.tax || 0,
      })) || [],

      // Totals
      subtotal: orderData.subtotal || 0,
      tax_amount: orderData.taxAmount || 0,
      discount_amount: orderData.discountAmount || 0,
      total: orderData.total || 0,

      // Payment
      payment_method: orderData.paymentMethod || 'cash',
      payment_status: orderData.paymentStatus || 'pending',
      paid_amount: orderData.paidAmount || 0,

      // Shipping
      shipping_address: orderData.shippingAddress || null,
      shipping_fee: orderData.shippingFee || 0,

      // Source
      source: 'storefront',
      channel: 'web',
    },
  };
}

/**
 * Convert product creation → simple_purchase event
 */
export function convertProductCreationToPurchaseEvent(productData) {
  return {
    eventType: 'simple_purchase',
    timestamp: new Date().toISOString(),
    data: {
      // Supplier info (for dropshipping or direct purchase)
      supplier_id: productData.supplierId || null,
      supplier_name: productData.supplierName || 'Nhà cung cấp trực tiếp',

      // Product info
      product_id: productData.productId,
      product_name: productData.productName,
      sku: productData.sku || `SKU-${Date.now()}`,

      // Inventory
      quantity: productData.quantity || 0,
      unit_price: productData.costPrice || 0,
      total_cost: (productData.quantity || 0) * (productData.costPrice || 0),

      // Inventory type
      inventory_type: productData.inventoryType || 'merchandise', // 'merchandise' or 'raw_material'

      // Category
      category: productData.category || 'general',
      
      // Source
      source: 'storefront',
      auto_generated: true, // Mark as auto-generated from storefront
    },
  };
}

/**
 * Convert order completion → sales_credit event
 */
export function convertOrderCompletionToCreditEvent(orderData) {
  return {
    eventType: 'sales_credit',
    timestamp: new Date().toISOString(),
    data: {
      // Customer info
      customer_id: orderData.customerId,
      customer_name: orderData.customerName,
      customer_email: orderData.customerEmail,
      customer_phone: orderData.customerPhone,

      // Order info
      order_code: orderData.orderCode,
      order_date: orderData.orderDate || new Date().toISOString(),
      
      // Line items
      items: orderData.items?.map(item => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice,
      })) || [],

      // Totals
      subtotal: orderData.subtotal || 0,
      tax_amount: orderData.taxAmount || 0,
      total: orderData.total || 0,

      // Credit info
      credit_term_days: orderData.creditTermDays || 30,
      due_date: orderData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      
      // Payment
      payment_method: 'credit',
      payment_status: 'pending',

      // Source
      source: 'storefront',
      channel: 'web',
    },
  };
}

/**
 * Validate event data before sending
 */
export function validateEventData(event) {
  const errors = [];

  if (!event.eventType) {
    errors.push('eventType is required');
  }

  if (!event.data) {
    errors.push('data is required');
  }

  // Validate based on event type
  switch (event.eventType) {
    case 'sale':
      if (!event.data.items || event.data.items.length === 0) {
        errors.push('sale event must have at least one item');
      }
      if (!event.data.total || event.data.total <= 0) {
        errors.push('sale event must have valid total');
      }
      break;

    case 'simple_purchase':
      if (!event.data.product_id) {
        errors.push('simple_purchase event must have product_id');
      }
      if (!event.data.quantity || event.data.quantity <= 0) {
        errors.push('simple_purchase event must have valid quantity');
      }
      break;

    case 'sales_credit':
      if (!event.data.customer_id) {
        errors.push('sales_credit event must have customer_id');
      }
      if (!event.data.total || event.data.total <= 0) {
        errors.push('sales_credit event must have valid total');
      }
      break;

    default:
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Send event to backend
 */
export async function sendEventToBackend(event, idempotencyKey = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch('/api/events', {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Batch send multiple events
 */
export async function sendBatchEvents(events, idempotencyKey = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch('/api/events/batch', {
    method: 'POST',
    headers,
    body: JSON.stringify({ events }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get event status
 */
export async function getEventStatus(eventId) {
  const response = await fetch(`/api/events/${eventId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}