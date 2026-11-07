// POST /api/stripe-webhook
// Stripe calls this after payment. The signature is checked against the RAW request body.
// NEVER read req.body in this file: the body must stay an unread stream, because any parsing or
// re-serialising changes the bytes and the signature check would fail. (This is a plain Vercel
// function, so there is no Next.js-style `config.api.bodyParser` switch to set.)
import Stripe from 'stripe';
import { header, readRawBody, send } from './_lib/http.js';
import { createServiceClient, createStore } from './_lib/store.js';

const PAID_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);
// The customer will not pay: put the reserved plants back.
const CANCEL_EVENTS = new Set(['checkout.session.expired', 'checkout.session.async_payment_failed']);

const orderIdFrom = (session) => {
  const raw = session.metadata?.order_id || session.client_reference_id;
  return /^\d{1,15}$/.test(String(raw || '')) ? Number(raw) : null;
};

export function createWebhookHandler({ env, getStore, getStripe }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });

    const signature = header(req, 'stripe-signature');
    if (!signature || !env.STRIPE_WEBHOOK_SECRET) return send(res, 400, { error: 'Bad signature.' });

    let event;
    try {
      const raw = await readRawBody(req, 1024 * 1024);
      event = getStripe().webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return send(res, 400, { error: 'Bad signature.' });
    }

    try {
      if (PAID_EVENTS.has(event.type)) {
        const s = event.data.object;
        // A delayed payment method fires "completed" before the money arrives; wait for the later event.
        if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') {
          return send(res, 200, { received: true, waiting: true });
        }
        const store = getStore();
        const ship = s.collected_information?.shipping_details || s.shipping_details || null;
        const details = s.customer_details || {};
        const r = await store.recordPayment({
          orderId: orderIdFrom(s),
          sessionId: s.id,
          paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id || null,
          email: details.email || s.customer_email || null,
          name: details.name || ship?.name || null,
          phone: details.phone || null,
          address: ship ? { name: ship.name || null, ...(ship.address || {}) } : null,
        });
        if (r.result === 'paid') {
          // Stock was reserved when the order was created, so nothing to take out here.
          // Money must match what we asked Stripe for.
          if (s.amount_total !== r.total_cents || s.currency !== 'usd' || r.currency !== 'usd') {
            console.error(`order ${r.orderId}: amount mismatch (stripe ${s.amount_total} ${s.currency}, order ${r.total_cents} ${r.currency}), flagged`);
            await store.flagConflict(r.orderId);
          }
        } else if (r.result === 'conflict') {
          console.error(`order ${r.orderId}: payment received for an order that was not pending, flagged for the owner`);
        } else if (r.result === 'unknown') {
          console.error(`payment for session ${s.id} matches no order`);
        }
      } else if (CANCEL_EVENTS.has(event.type)) {
        const s = event.data.object;
        await getStore().cancelAndRelease({ orderId: orderIdFrom(s), sessionId: s.id });
      }
      return send(res, 200, { received: true });
    } catch (err) {
      console.error('webhook handling failed:', err?.message || err);
      return send(res, 500, { error: 'Temporary problem. Please retry.' });
    }
  };
}

let real;
export default function handler(req, res) {
  real ||= createWebhookHandler({
    env: process.env,
    getStore: () => createStore(createServiceClient(process.env)),
    getStripe: () => new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_unset'),
  });
  return real(req, res);
}
