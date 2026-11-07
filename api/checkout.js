// POST /api/checkout
// Body: { items: [{ id, qty }], shipping: 'standard' | 'express' | 'pickup', email?: string }
// Re-prices everything from the database, saves a pending order, opens a Stripe Checkout Session
// and returns { url } for the browser to redirect to. Card details never reach this server.
import Stripe from 'stripe';
import { priceCart, PRODUCT_ID_RE, SHIPPING_METHODS } from '../shared/pricing.js';
import { clientIp, createLimiter, header, readRawBody, send, siteUrl, sameOrigin } from './_lib/http.js';
import { createServiceClient, createStore } from './_lib/store.js';

const MAX_BODY_BYTES = 8 * 1024;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GENERIC = 'Something went wrong starting checkout. Please try again in a moment.';

export function createCheckoutHandler({ env, getStore, getStripe, limiter }) {
  const allow = limiter || createLimiter({ max: 10, windowMs: 60_000 });

  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    // Fail closed: without a configured public address we cannot build safe return links.
    let site;
    try {
      site = siteUrl(env);
    } catch (err) {
      console.error('checkout misconfigured:', err.message);
      return send(res, 500, { error: GENERIC });
    }
    if (!sameOrigin(req, [new URL(site).host])) return send(res, 403, { error: 'Request not allowed.' });
    if (!allow(clientIp(req))) return send(res, 429, { error: 'Too many attempts. Please wait a minute.' }, { 'Retry-After': '60' });

    const declared = Number(header(req, 'content-length') || 0);
    if (declared > MAX_BODY_BYTES) return send(res, 413, { error: 'Request too large.' });

    let orderId = null;
    let store;
    try {
      // Vercel parses the body lazily and the getter throws on malformed JSON, so read it in here.
      let body = req.body;
      try {
        if (body === undefined || body === null || body === '') {
          body = JSON.parse((await readRawBody(req, MAX_BODY_BYTES)).toString('utf8') || 'null');
        } else if (typeof body === 'string') {
          if (Buffer.byteLength(body) > MAX_BODY_BYTES) return send(res, 413, { error: 'Request too large.' });
          body = JSON.parse(body);
        }
      } catch {
        return send(res, 400, { error: 'Your request could not be read.' });
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return send(res, 400, { error: 'Your request could not be read.' });
      }

      const { items, shipping } = body;
      let email = body.email;
      if (email !== undefined && email !== null && email !== '') {
        if (typeof email !== 'string' || email.length > 254 || !emailRe.test(email.trim())) {
          return send(res, 400, { error: 'Enter a valid email address or leave it blank.' });
        }
        email = email.trim();
      } else {
        email = undefined;
      }

      // Cheap shape check before touching the database.
      if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
        return send(res, 400, { error: Array.isArray(items) && items.length ? 'Your cart has too many lines.' : 'Your cart is empty.' });
      }
      const ids = [];
      for (const it of items) {
        if (it && typeof it === 'object' && typeof it.id === 'string' && PRODUCT_ID_RE.test(it.id)) ids.push(it.id);
      }

      store = getStore();
      const products = ids.length ? await store.getProductsByIds([...new Set(ids)]) : {};
      const priced = priceCart(items, products, shipping);
      if (!priced.ok) {
        const status = priced.code === 'stock' || priced.code === 'unavailable' ? 409 : 400;
        return send(res, status, { error: priced.message, code: priced.code });
      }

      orderId = await store.createPendingOrder({
        method: shipping,
        subtotal: priced.subtotal,
        shipping: priced.shipping,
        total: priced.total,
        lines: priced.lines,
      });

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: priced.lines.map((l) => ({
          quantity: l.qty,
          price_data: {
            currency: 'usd',
            unit_amount: l.unit_price_cents,
            product_data: {
              name: l.name,
              ...(/^https:\/\//.test(l.image_url) && l.image_url.length < 2000 ? { images: [l.image_url] } : {}),
            },
          },
        })),
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: priced.shipping, currency: 'usd' },
              display_name: `${SHIPPING_METHODS[shipping].label} - ${SHIPPING_METHODS[shipping].detail}`,
            },
          },
        ],
        ...(shipping === 'pickup' ? {} : { shipping_address_collection: { allowed_countries: ['US'] } }),
        phone_number_collection: { enabled: true },
        ...(email ? { customer_email: email } : {}),
        client_reference_id: String(orderId),
        metadata: { order_id: String(orderId) },
        payment_intent_data: { metadata: { order_id: String(orderId) } },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        success_url: `${site}/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site}/?checkout=cancelled`,
      });

      await store.attachSession(orderId, session.id);
      return send(res, 200, { url: session.url });
    } catch (err) {
      if (err?.code === 'stock') {
        return send(res, 409, { error: 'Sorry, one of the plants in your cart just sold out. Please update your cart.', code: 'stock' });
      }
      console.error('checkout failed:', err?.message || err);
      if (orderId && store) {
        try {
          await store.cancelAndRelease({ orderId });
        } catch (e) {
          console.error('could not cancel unfinished order:', e?.message || e);
        }
      }
      return send(res, 500, { error: GENERIC });
    }
  };
}

let real;
export default function handler(req, res) {
  real ||= createCheckoutHandler({
    env: process.env,
    getStore: () => createStore(createServiceClient(process.env)),
    getStripe: () => new Stripe(process.env.STRIPE_SECRET_KEY),
  });
  return real(req, res);
}
