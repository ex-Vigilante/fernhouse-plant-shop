// POST /api/admin-cancel   Authorization: Bearer <admin's access token>   Body: { order_id }
// Cancels an UNPAID order: closes its Stripe payment page (so it can no longer be paid), puts the
// reserved plants back and marks the order cancelled. Paid orders are never touched here.
import Stripe from 'stripe';
import { clientIp, createLimiter, header, readRawBody, send, siteUrl, sameOrigin } from './_lib/http.js';
import { createServiceClient, createStore } from './_lib/store.js';

export function createAdminCancelHandler({ env, getStore, getStripe, limiter }) {
  const allow = limiter || createLimiter({ max: 30, windowMs: 60_000 });

  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    let site;
    try {
      site = siteUrl(env);
    } catch (err) {
      console.error('admin-cancel misconfigured:', err.message);
      return send(res, 500, { error: 'Something went wrong.' });
    }
    if (!sameOrigin(req, [new URL(site).host])) return send(res, 403, { error: 'Request not allowed.' });
    if (!allow(clientIp(req))) return send(res, 429, { error: 'Too many requests.' }, { 'Retry-After': '60' });

    const token = (header(req, 'authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return send(res, 401, { error: 'Please sign in again.' });

    try {
      const store = getStore();
      if (!(await store.adminFromToken(token))) return send(res, 403, { error: 'No access.' });

      let body = req.body;
      if (body === undefined || body === null || body === '') {
        body = JSON.parse((await readRawBody(req, 2048)).toString('utf8') || 'null');
      } else if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      const orderId = body?.order_id;
      if (!Number.isInteger(orderId) || orderId < 1) return send(res, 400, { error: 'Invalid order.' });

      const order = await store.getOrderForCancel(orderId);
      if (!order) return send(res, 404, { error: 'Order not found.' });
      if (order.status !== 'pending') return send(res, 409, { error: 'Only unpaid orders can be cancelled here. Refresh the list.' });

      if (order.stripe_session_id) {
        const stripe = getStripe();
        try {
          await stripe.checkout.sessions.expire(order.stripe_session_id);
        } catch (err) {
          const s = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
          if (s.status === 'complete') {
            return send(res, 409, { error: 'This order was just paid. Refresh the list.' });
          }
          if (s.status !== 'expired') throw err;
        }
      }
      await store.cancelAndRelease({ orderId });
      return send(res, 200, { ok: true });
    } catch (err) {
      console.error('admin cancel failed:', err?.message || err);
      return send(res, 500, { error: 'The order could not be cancelled. Please try again.' });
    }
  };
}

let real;
export default function handler(req, res) {
  real ||= createAdminCancelHandler({
    env: process.env,
    getStore: () => createStore(createServiceClient(process.env)),
    getStripe: () => new Stripe(process.env.STRIPE_SECRET_KEY),
  });
  return real(req, res);
}
