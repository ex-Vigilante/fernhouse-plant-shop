// Pricing and cart rules shared by the browser and the server functions.
// Everything here works in whole cents so totals never drift.

export const FREE_SHIPPING_CENTS = 7500;
export const MAX_QTY_PER_LINE = 20;
export const MAX_CART_LINES = 30;
export const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

export const SHIPPING_METHODS = {
  standard: { label: 'Standard', detail: '4 to 6 business days', cents: 850 },
  express: { label: 'Express', detail: '2 business days, in a heat-safe box', cents: 1600 },
  pickup: { label: 'Portland pickup', detail: 'Ready the next day at our greenhouse', cents: 0 },
};

export const isShippingMethod = (id) =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(SHIPPING_METHODS, id);

/** Standard shipping is free from $75 of plants. Throws on an unknown method. */
export function shippingCents(method, subtotalCents) {
  if (!isShippingMethod(method)) throw new Error('unknown shipping method');
  if (method === 'standard' && subtotalCents >= FREE_SHIPPING_CENTS) return 0;
  return SHIPPING_METHODS[method].cents;
}

/**
 * Checks a cart sent by a browser against the real catalog and prices it.
 *  rawItems: [{ id, qty }]    productsById: { [id]: { id, name, price_cents, stock, active } }
 * Returns { ok: true, lines, subtotal, shipping, total } or { ok: false, code, message }.
 * Client-supplied prices are never read.
 */
export function priceCart(rawItems, productsById, method) {
  const fail = (code, message) => ({ ok: false, code, message });
  if (!isShippingMethod(method)) return fail('shipping', 'Choose a delivery method.');
  if (!Array.isArray(rawItems) || rawItems.length === 0) return fail('empty', 'Your cart is empty.');
  if (rawItems.length > MAX_CART_LINES) return fail('too_many', 'Your cart has too many lines.');

  const merged = new Map();
  for (const it of rawItems) {
    if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !PRODUCT_ID_RE.test(it.id)) {
      return fail('invalid', 'Your cart could not be read.');
    }
    const qty = it.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return fail('invalid', 'Quantities must be whole numbers from 1 to 20.');
    }
    merged.set(it.id, (merged.get(it.id) || 0) + qty);
  }

  const lines = [];
  let subtotal = 0;
  for (const [id, qty] of merged) {
    const p = Object.prototype.hasOwnProperty.call(productsById, id) ? productsById[id] : null;
    if (!p || !p.active) return fail('unavailable', 'A plant in your cart is no longer available.');
    if (qty > MAX_QTY_PER_LINE || qty > p.stock) {
      return fail('stock', `Only ${Math.max(p.stock, 0)} of ${p.name} left. Please update your cart.`);
    }
    lines.push({ id: p.id, name: p.name, qty, unit_price_cents: p.price_cents, image_url: p.image_url || '' });
    subtotal += p.price_cents * qty;
  }
  const shipping = shippingCents(method, subtotal);
  return { ok: true, lines, subtotal, shipping, total: subtotal + shipping };
}
