// GET /api/order?session_id=cs_...
// Public summary for the "thank you" page. Looked up by the Stripe session id only and returns
// no contact details apart from the buyer's first name.
import { clientIp, createLimiter, send } from './_lib/http.js';
import { createServiceClient, createStore } from './_lib/store.js';

const SESSION_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export function createOrderHandler({ getStore, limiter }) {
  const allow = limiter || createLimiter({ max: 60, windowMs: 60_000 });

  return async function handler(req, res) {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
    if (!allow(clientIp(req))) return send(res, 429, { error: 'Too many requests.' }, { 'Retry-After': '60' });

    let sessionId = req.query?.session_id;
    if (sessionId === undefined) {
      try {
        sessionId = new URL(req.url || '', 'http://local').searchParams.get('session_id');
      } catch {
        sessionId = null;
      }
    }
    if (typeof sessionId !== 'string' || !SESSION_RE.test(sessionId)) {
      return send(res, 400, { error: 'Missing or invalid order reference.' });
    }

    try {
      const o = await getStore().getOrderBySession(sessionId);
      if (!o) return send(res, 404, { error: 'Order not found.' });
      const firstName = (o.customer_name || '').trim().split(/\s+/)[0] || null;
      return send(res, 200, {
        number: `FH-${o.id}`,
        status: o.status,
        firstName,
        shipping_method: o.shipping_method,
        items: (o.order_items || []).map((i) => ({ name: i.name, qty: i.qty, unit_price_cents: i.unit_price_cents })),
        subtotal_cents: o.subtotal_cents,
        shipping_cents: o.shipping_cents,
        total_cents: o.total_cents,
        currency: o.currency,
      });
    } catch (err) {
      console.error('order lookup failed:', err?.message || err);
      return send(res, 500, { error: 'Could not load your order. Please refresh.' });
    }
  };
}

let real;
export default function handler(req, res) {
  real ||= createOrderHandler({ getStore: () => createStore(createServiceClient(process.env)) });
  return real(req, res);
}
