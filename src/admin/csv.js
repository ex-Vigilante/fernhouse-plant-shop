// CSV export for the orders list. Pure functions, no browser APIs except in download().

const dollars = (c) => ((c || 0) / 100).toFixed(2);

/** Quotes a cell. Cells that start with = + - @ are prefixed so spreadsheets never run them as formulas. */
export function cell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const HEADERS = [
  'Order', 'Placed', 'Status', 'Name', 'Email', 'Phone', 'Delivery',
  'Address line 1', 'Address line 2', 'City', 'State', 'ZIP', 'Country',
  'Items', 'Subtotal', 'Shipping', 'Total', 'Currency', 'Stripe payment', 'Payment conflict',
];

export function ordersToCsv(orders) {
  const rows = orders.map((o) => {
    const a = o.shipping_address || {};
    const items = (o.order_items || []).map((i) => `${i.name} x${i.qty}`).join('; ');
    return [
      `FH-${o.id}`, o.created_at, o.status, o.customer_name, o.email, o.phone, o.shipping_method,
      a.line1, a.line2, a.city, a.state, a.postal_code, a.country,
      items, dollars(o.subtotal_cents), dollars(o.shipping_cents), dollars(o.total_cents),
      (o.currency || 'usd').toUpperCase(), o.stripe_payment_intent, o.payment_conflict ? 'yes' : '',
    ].map(cell).join(',');
  });
  // BOM first so Excel reads accents and symbols as UTF-8
  return `﻿${[HEADERS.map(cell).join(','), ...rows].join('\r\n')}\r\n`;
}

export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
