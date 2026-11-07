// Run with: npm test   (Node's built-in test runner, no network or real keys needed)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import Stripe from 'stripe';
import { priceCart, shippingCents } from '../shared/pricing.js';
import { createCheckoutHandler } from '../api/checkout.js';
import { createWebhookHandler } from '../api/stripe-webhook.js';
import { createOrderHandler } from '../api/order.js';
import { createAdminCancelHandler } from '../api/admin-cancel.js';
import { siteUrl } from '../api/_lib/http.js';

const PRODUCTS = {
  monstera: { id: 'monstera', name: 'Monstera', price_cents: 6800, stock: 9, active: true, image_url: 'https://x.test/m.jpg' },
  pothos: { id: 'pothos', name: 'Pothos', price_cents: 2800, stock: 31, active: true, image_url: '' },
  aloe: { id: 'aloe', name: 'Aloe', price_cents: 2400, stock: 0, active: true, image_url: '' },
  hidden: { id: 'hidden', name: 'Hidden', price_cents: 1000, stock: 5, active: false, image_url: '' },
};

// ---------- pricing ----------
test('shipping rules: standard 8.50, free from 75, express 16, pickup 0', () => {
  assert.equal(shippingCents('standard', 7499), 850);
  assert.equal(shippingCents('standard', 7500), 0);
  assert.equal(shippingCents('express', 9999), 1600);
  assert.equal(shippingCents('pickup', 100), 0);
  assert.throws(() => shippingCents('drone', 100));
});

test('priceCart computes totals from catalog prices and merges duplicate lines', () => {
  const r = priceCart([{ id: 'monstera', qty: 1 }, { id: 'pothos', qty: 2 }, { id: 'pothos', qty: 1 }], PRODUCTS, 'standard');
  assert.equal(r.ok, true);
  assert.equal(r.subtotal, 6800 + 3 * 2800);
  assert.equal(r.shipping, 0);
  assert.equal(r.total, r.subtotal);
  assert.equal(r.lines.length, 2);
});

test('priceCart ignores client-supplied prices', () => {
  const r = priceCart([{ id: 'monstera', qty: 1, price: 1, unit_price_cents: 1 }], PRODUCTS, 'express');
  assert.equal(r.subtotal, 6800);
  assert.equal(r.total, 6800 + 1600);
});

test('priceCart rejects bad carts', () => {
  const bad = (items, method = 'standard') => priceCart(items, PRODUCTS, method);
  assert.equal(bad([{ id: 'nope', qty: 1 }]).code, 'unavailable');
  assert.equal(bad([{ id: 'hidden', qty: 1 }]).code, 'unavailable');
  assert.equal(bad([{ id: 'aloe', qty: 1 }]).code, 'stock');
  assert.equal(bad([{ id: 'monstera', qty: 10 }]).code, 'stock');
  assert.equal(bad([{ id: 'monstera', qty: 5 }, { id: 'monstera', qty: 5 }]).code, 'stock');
  assert.equal(bad([{ id: 'monstera', qty: -1 }]).code, 'invalid');
  assert.equal(bad([{ id: 'monstera', qty: 0 }]).code, 'invalid');
  assert.equal(bad([{ id: 'monstera', qty: 1.5 }]).code, 'invalid');
  assert.equal(bad([{ id: 'monstera', qty: '2' }]).code, 'invalid');
  assert.equal(bad([{ id: 'monstera', qty: 21 }]).code, 'invalid');
  assert.equal(bad([{ id: 'pothos', qty: 1e9 }]).code, 'invalid');
  assert.equal(bad([]).code, 'empty');
  assert.equal(bad('x').code, 'empty');
  assert.equal(bad([null]).code, 'invalid');
  assert.equal(bad([{ id: { $ne: 1 }, qty: 1 }]).code, 'invalid');
  assert.equal(bad(Array.from({ length: 500 }, () => ({ id: 'pothos', qty: 1 }))).code, 'too_many');
  assert.equal(bad([{ id: 'pothos', qty: 1 }], 'drone').code, 'shipping');
  assert.equal(bad([{ id: 'constructor', qty: 1 }]).code, 'unavailable');
});

test('product ids must match ^[a-z0-9][a-z0-9-]{0,59}$', () => {
  for (const id of ['__proto__', 'Monstera', '-x', 'a b', "x'y", 'a'.repeat(61), '', 'é']) {
    assert.equal(priceCart([{ id, qty: 1 }], PRODUCTS, 'standard').code, 'invalid', `id ${JSON.stringify(id)}`);
  }
  assert.equal(priceCart([{ id: 'a'.repeat(60), qty: 1 }], {}, 'standard').code, 'unavailable');
  assert.equal(priceCart([{ id: '9-lives', qty: 1 }], {}, 'standard').code, 'unavailable');
});

// ---------- helpers ----------
function mockRes() {
  const res = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b || ''; };
  Object.defineProperty(res, 'json', { get: () => JSON.parse(res.body) });
  return res;
}
const ENV = { SITE_URL: 'https://shop.test', STRIPE_WEBHOOK_SECRET: 'whsec_throwaway_test_secret' };
const quiet = async (fn) => {
  const keep = [console.error, console.warn];
  console.error = console.warn = () => {};
  try { return await fn(); } finally { [console.error, console.warn] = keep; }
};

// In-memory copy of the database rules (reserve on create, release once for a cancelled order,
// payment conflicts) so the handlers can be exercised. The SQL itself is not run by these tests.
function fakeStore() {
  const stock = Object.fromEntries(Object.values(PRODUCTS).map((p) => [p.id, p.stock]));
  const s = {
    stock, orders: [], attached: [], flagged: [],
    async getProductsByIds(ids) {
      return Object.fromEntries(ids.filter((i) => PRODUCTS[i]).map((i) => [i, { ...PRODUCTS[i], stock: stock[i] }]));
    },
    async createPendingOrder(o) {
      for (const l of o.lines) {
        if (!PRODUCTS[l.id]?.active || stock[l.id] < l.qty) throw Object.assign(new Error('insufficient stock'), { code: 'stock' });
      }
      for (const l of o.lines) stock[l.id] -= l.qty;
      const id = 1001 + s.orders.length;
      s.orders.push({ ...o, id, status: 'pending', reserved: true, released: false, conflict: false });
      return id;
    },
    async attachSession(id, sid) { s.attached.push([id, sid]); s.orders.find((o) => o.id === id).session = sid; },
    async cancelAndRelease({ orderId, sessionId }) {
      const o = s.orders.find((x) => x.id === orderId || (sessionId && x.session === sessionId));
      if (!o) return null;
      if (o.status === 'pending') o.status = 'cancelled';
      if (o.status === 'cancelled' && o.reserved && !o.released) {
        o.released = true;
        for (const l of o.lines) stock[l.id] += l.qty;
      }
      return o.id;
    },
    async recordPayment({ orderId, sessionId, ...rest }) {
      const o = s.orders.find((x) => x.id === orderId || (!orderId && x.session === sessionId));
      if (!o) return { result: 'unknown', orderId: null };
      if (o.status === 'pending') {
        Object.assign(o, { status: 'paid', session: sessionId, ...rest });
        return { result: 'paid', orderId: o.id, total_cents: o.total, currency: 'usd' };
      }
      if (['paid', 'shipped', 'delivered'].includes(o.status)) return { result: 'duplicate', orderId: o.id };
      Object.assign(o, { session: sessionId, ...rest, conflict: true });
      return { result: 'conflict', orderId: o.id };
    },
    async flagConflict(id) { s.flagged.push(id); s.orders.find((o) => o.id === id).conflict = true; },
    async findOrderIdBySession(sid) { return s.orders.find((o) => o.session === sid)?.id ?? null; },
    async getOrderForCancel(id) {
      const o = s.orders.find((x) => x.id === id);
      return o && { id: o.id, status: o.status, stripe_session_id: o.session || null };
    },
    async adminFromToken(t) { return t === 'good-token' ? { id: 'u1', email: 'a@x.test' } : null; },
    async getOrderBySession(sid) {
      const o = s.orders.find((x) => x.session === sid);
      return o && {
        id: o.id, status: o.status, customer_name: o.name || null, shipping_method: o.method,
        subtotal_cents: o.subtotal, shipping_cents: o.shipping, total_cents: o.total, currency: 'usd',
        order_items: o.lines.map((l) => ({ name: l.name, qty: l.qty, unit_price_cents: l.unit_price_cents })),
      };
    },
  };
  return s;
}

function fakeStripe() {
  const calls = [];
  const real = new Stripe('sk_test_throwaway');
  return {
    calls,
    webhooks: real.webhooks,
    checkout: { sessions: { create: async (args) => { calls.push(args); return { id: 'cs_test_abcdefghij1234567890', url: 'https://checkout.stripe.test/pay/x' }; } } },
  };
}

const post = (body, headers = {}) => ({
  method: 'POST',
  headers: { origin: 'https://shop.test', host: 'shop.test', 'x-forwarded-for': '1.2.3.4', ...headers },
  body,
});

// ---------- checkout handler ----------
test('checkout: valid cart reserves stock, creates a pending order and a Stripe session with server prices', async () => {
  const store = fakeStore();
  const stripe = fakeStripe();
  const h = createCheckoutHandler({ env: ENV, getStore: () => store, getStripe: () => stripe });
  const res = mockRes();
  await h(post({ items: [{ id: 'monstera', qty: 1, price: 1 }], shipping: 'standard', email: 'a@b.co' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.url, 'https://checkout.stripe.test/pay/x');
  const args = stripe.calls[0];
  assert.equal(args.line_items[0].price_data.unit_amount, 6800);
  assert.equal(args.shipping_options[0].shipping_rate_data.fixed_amount.amount, 850);
  assert.equal(args.client_reference_id, '1001');
  assert.deepEqual(args.shipping_address_collection, { allowed_countries: ['US'] });
  assert.equal(args.phone_number_collection.enabled, true);
  assert.equal(args.success_url, 'https://shop.test/order/success?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(args.cancel_url, 'https://shop.test/?checkout=cancelled');
  assert.deepEqual(store.attached, [[1001, 'cs_test_abcdefghij1234567890']]);
  assert.equal(store.orders[0].total, 6800 + 850);
  assert.equal(store.stock.monstera, 8, 'one plant reserved');
});

test('checkout: pickup skips the address and charges no shipping', async () => {
  const stripe = fakeStripe();
  const h = createCheckoutHandler({ env: ENV, getStore: fakeStore, getStripe: () => stripe });
  const res = mockRes();
  await h(post({ items: [{ id: 'pothos', qty: 1 }], shipping: 'pickup' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(stripe.calls[0].shipping_address_collection, undefined);
  assert.equal(stripe.calls[0].shipping_options[0].shipping_rate_data.fixed_amount.amount, 0);
});

test('checkout: rejects wrong method, foreign origin, missing origin, bad json, huge payload', async () => {
  const h = createCheckoutHandler({ env: ENV, getStore: fakeStore, getStripe: fakeStripe });
  const run = async (req) => { const r = mockRes(); await h(req, r); return r; };
  assert.equal((await run({ method: 'GET', headers: {} })).statusCode, 405);
  assert.equal((await run(post({ items: [], shipping: 'standard' }, { origin: 'https://evil.test' }))).statusCode, 403);
  assert.equal((await run(post({ items: [], shipping: 'standard' }, { origin: undefined }))).statusCode, 403);
  assert.equal((await run(post('{not json'))).statusCode, 400);
  assert.equal((await run(post(['x']))).statusCode, 400);
  assert.equal((await run(post({ items: [{ id: 'pothos', qty: 1 }], shipping: 'standard' }, { 'content-length': '999999' }))).statusCode, 413);
  assert.equal((await run(post({ items: [{ id: 'aloe', qty: 1 }], shipping: 'standard' }))).statusCode, 409);
  assert.equal((await run(post({ items: [{ id: 'monstera', qty: -3 }], shipping: 'standard' }))).statusCode, 400);
  assert.equal((await run(post({ items: [{ id: 'pothos', qty: 1 }], shipping: 'standard', email: 'nope' }))).statusCode, 400);
  assert.equal((await run(post({ items: [{ id: "x'; drop table", qty: 1 }], shipping: 'standard' }))).statusCode, 400);
  const huge = Array.from({ length: 5000 }, () => ({ id: 'pothos', qty: 1 }));
  assert.equal((await run(post({ items: huge, shipping: 'standard' }))).statusCode, 400);
});

test('checkout: per-IP rate limit', async () => {
  const h = createCheckoutHandler({ env: ENV, getStore: fakeStore, getStripe: fakeStripe });
  let last;
  for (let i = 0; i < 12; i++) { last = mockRes(); await h(post({ items: [{ id: 'pothos', qty: 1 }], shipping: 'standard' }), last); }
  assert.equal(last.statusCode, 429);
});

test('checkout: a Stripe failure returns a generic error, cancels the order and releases the reservation', async () => {
  const store = fakeStore();
  const stripe = { checkout: { sessions: { create: async () => { throw new Error('sk_test_secret exploded'); } } } };
  const h = createCheckoutHandler({ env: ENV, getStore: () => store, getStripe: () => stripe });
  const res = mockRes();
  await quiet(() => h(post({ items: [{ id: 'pothos', qty: 1 }], shipping: 'standard' }), res));
  assert.equal(res.statusCode, 500);
  assert.ok(!res.body.includes('sk_test'));
  assert.equal(store.orders[0].status, 'cancelled');
  assert.equal(store.stock.pothos, 31, 'reservation released');
});

test('checkout reserves stock so a second buyer cannot take the last plants', async () => {
  const store = fakeStore();
  const h = createCheckoutHandler({ env: ENV, getStore: () => store, getStripe: fakeStripe, limiter: () => true });
  const buy = async (qty) => { const r = mockRes(); await h(post({ items: [{ id: 'monstera', qty }], shipping: 'standard' }), r); return r; };
  assert.equal((await buy(6)).statusCode, 200);
  assert.equal(store.stock.monstera, 3);
  assert.equal((await buy(4)).statusCode, 409);
  assert.equal(store.stock.monstera, 3, 'a refused checkout reserves nothing');
  assert.equal(store.orders.length, 1);
});

test('checkout: a stock race reported by the database becomes a clear 409', async () => {
  const store = fakeStore();
  store.createPendingOrder = async () => { throw Object.assign(new Error('x'), { code: 'stock' }); };
  const h = createCheckoutHandler({ env: ENV, getStore: () => store, getStripe: fakeStripe });
  const r = mockRes();
  await h(post({ items: [{ id: 'monstera', qty: 1 }], shipping: 'standard' }), r);
  assert.equal(r.statusCode, 409);
  assert.match(r.json.error, /sold out/);
});

test('siteUrl fails closed without a valid SITE_URL, and checkout returns a generic 500', async () => {
  assert.throws(() => siteUrl({}));
  assert.throws(() => siteUrl({ SITE_URL: 'not a url' }));
  assert.throws(() => siteUrl({ SITE_URL: 'http://shop.test' }));
  assert.equal(siteUrl({ SITE_URL: 'https://shop.test/' }), 'https://shop.test');
  const h = createCheckoutHandler({ env: {}, getStore: fakeStore, getStripe: fakeStripe });
  const r = mockRes();
  await quiet(() => h(post({ items: [{ id: 'pothos', qty: 1 }], shipping: 'standard' }), r));
  assert.equal(r.statusCode, 500);
});

test('checkout: a throwing lazy req.body getter does not crash the handler', async () => {
  const h = createCheckoutHandler({ env: ENV, getStore: fakeStore, getStripe: fakeStripe });
  const req = { method: 'POST', headers: { origin: 'https://shop.test', host: 'shop.test' } };
  Object.defineProperty(req, 'body', { get() { throw new SyntaxError('bad json'); } });
  const r = mockRes();
  await quiet(() => h(req, r));
  assert.equal(r.statusCode, 500);
  assert.ok(!r.body.includes('SyntaxError'));
});

// ---------- webhook ----------
const stripeLib = new Stripe('sk_test_throwaway');
function signedReq(payload, secret = ENV.STRIPE_WEBHOOK_SECRET, tamper = false) {
  const header = stripeLib.webhooks.generateTestHeaderString({ payload, secret });
  const body = tamper ? payload.replace('1001', '1002') : payload;
  const req = Readable.from([Buffer.from(body)]);
  req.method = 'POST';
  req.headers = { 'stripe-signature': header };
  return req;
}
const sessionEvent = (type, extra = {}) => JSON.stringify({
  id: 'evt_1', object: 'event', type,
  data: { object: { id: 'cs_test_abcdefghij1234567890', object: 'checkout.session', payment_status: 'paid', amount_total: 7650, currency: 'usd', payment_intent: 'pi_123', client_reference_id: '1001', metadata: { order_id: '1001' }, customer_details: { email: 'buyer@x.test', name: 'Ada Lovelace', phone: '+15035550100' }, collected_information: { shipping_details: { name: 'Ada Lovelace', address: { line1: '1 Fern St', city: 'Portland', state: 'OR', postal_code: '97205', country: 'US' } } }, ...extra } },
});

async function seeded() {
  const store = fakeStore();
  const id = await store.createPendingOrder({ method: 'standard', subtotal: 6800, shipping: 850, total: 7650, lines: [{ id: 'monstera', name: 'Monstera', qty: 1, unit_price_cents: 6800 }] });
  assert.equal(id, 1001);
  store.orders[0].session = 'cs_test_abcdefghij1234567890';
  const h = createWebhookHandler({ env: ENV, getStore: () => store, getStripe: () => stripeLib });
  return { store, h };
}
const run = async (h, payload) => { const r = mockRes(); await h(signedReq(payload), r); return r; };

test('webhook: valid signature marks the order paid and keeps the reservation', async () => {
  const { store, h } = await seeded();
  const res = await run(h, sessionEvent('checkout.session.completed'));
  assert.equal(res.statusCode, 200);
  const o = store.orders[0];
  assert.equal(o.status, 'paid');
  assert.equal(o.email, 'buyer@x.test');
  assert.equal(o.address.city, 'Portland');
  assert.equal(o.paymentIntent, 'pi_123');
  assert.equal(o.conflict, false);
  assert.equal(store.stock.monstera, 8, 'stock stays reserved');
  // a second delivery (Stripe retry or a later event) changes nothing
  assert.equal((await run(h, sessionEvent('checkout.session.async_payment_succeeded'))).statusCode, 200);
  assert.equal(store.stock.monstera, 8);
  // and a paid order is never released by a late "expired"
  assert.equal((await run(h, sessionEvent('checkout.session.expired'))).statusCode, 200);
  assert.equal(o.status, 'paid');
  assert.equal(store.stock.monstera, 8);
});

test('webhook: amount or currency mismatch flags the order', async () => {
  for (const extra of [{ amount_total: 100 }, { currency: 'eur' }]) {
    const { store, h } = await seeded();
    await quiet(() => run(h, sessionEvent('checkout.session.completed', extra)));
    assert.equal(store.orders[0].status, 'paid');
    assert.deepEqual(store.flagged, [1001], JSON.stringify(extra));
  }
  const { store, h } = await seeded();
  await run(h, sessionEvent('checkout.session.completed'));
  assert.deepEqual(store.flagged, [], 'matching amount is not flagged');
});

test('webhook: tampered body or wrong secret or no header gives 400 and changes nothing', async () => {
  const { store, h } = await seeded();
  const payload = sessionEvent('checkout.session.completed');
  const a = mockRes(); await h(signedReq(payload, ENV.STRIPE_WEBHOOK_SECRET, true), a);
  const b = mockRes(); await h(signedReq(payload, 'whsec_other'), b);
  const c = mockRes(); const req = signedReq(payload); delete req.headers['stripe-signature']; await h(req, c);
  assert.deepEqual([a.statusCode, b.statusCode, c.statusCode], [400, 400, 400]);
  assert.equal(store.orders[0].status, 'pending');
});

test('webhook: unpaid waits; expired and async_payment_failed cancel and release exactly once', async () => {
  for (const type of ['checkout.session.expired', 'checkout.session.async_payment_failed']) {
    const { store, h } = await seeded();
    assert.equal((await run(h, sessionEvent('checkout.session.completed', { payment_status: 'unpaid' }))).statusCode, 200);
    assert.equal(store.orders[0].status, 'pending');
    assert.equal(store.stock.monstera, 8);
    assert.equal((await run(h, sessionEvent(type))).statusCode, 200);
    assert.equal(store.orders[0].status, 'cancelled', type);
    assert.equal(store.stock.monstera, 9, 'released');
    assert.equal((await run(h, sessionEvent(type))).statusCode, 200);
    assert.equal(store.stock.monstera, 9, 'a repeat delivery does not release again');
  }
});

test('webhook: payment for an already-cancelled order saves details and flags a payment conflict', async () => {
  const { store, h } = await seeded();
  await run(h, sessionEvent('checkout.session.expired'));
  const res = await quiet(() => run(h, sessionEvent('checkout.session.completed')));
  assert.equal(res.statusCode, 200);
  const o = store.orders[0];
  assert.equal(o.status, 'cancelled');
  assert.equal(o.conflict, true);
  assert.equal(o.email, 'buyer@x.test');
  assert.equal(o.paymentIntent, 'pi_123');
  assert.equal(store.stock.monstera, 9, 'no second release');
});

test('webhook: database failure returns 500 so Stripe retries', async () => {
  const { store, h } = await seeded();
  store.recordPayment = async () => { throw new Error('db down'); };
  const res = await quiet(() => run(h, sessionEvent('checkout.session.completed')));
  assert.equal(res.statusCode, 500);
});

// ---------- admin cancel ----------
test('admin cancel: needs an admin token, expires the Stripe session, releases stock once', async () => {
  const store = fakeStore();
  const stripe = fakeStripe();
  const expired = [];
  stripe.checkout.sessions.expire = async (id) => { expired.push(id); return {}; };
  const co = createCheckoutHandler({ env: ENV, getStore: () => store, getStripe: () => stripe });
  await co(post({ items: [{ id: 'monstera', qty: 2 }], shipping: 'standard' }), mockRes());
  assert.equal(store.stock.monstera, 7);
  const h = createAdminCancelHandler({ env: ENV, getStore: () => store, getStripe: () => stripe, limiter: () => true });
  const call = async (token, body) => { const r = mockRes(); await h(post(body, token ? { authorization: `Bearer ${token}` } : {}), r); return r; };
  assert.equal((await call(null, { order_id: 1001 })).statusCode, 401);
  assert.equal((await call('bad-token', { order_id: 1001 })).statusCode, 403);
  assert.equal((await call('good-token', { order_id: 'x' })).statusCode, 400);
  assert.equal((await call('good-token', { order_id: 1001 })).statusCode, 200);
  assert.deepEqual(expired, ['cs_test_abcdefghij1234567890']);
  assert.equal(store.orders[0].status, 'cancelled');
  assert.equal(store.stock.monstera, 9);
  assert.equal((await call('good-token', { order_id: 1001 })).statusCode, 409);
  assert.equal(store.stock.monstera, 9);
});

test('admin cancel: refuses a paid order', async () => {
  const { store } = await seeded();
  await store.recordPayment({ orderId: 1001, sessionId: 'cs_test_abcdefghij1234567890' });
  const h = createAdminCancelHandler({ env: ENV, getStore: () => store, getStripe: fakeStripe, limiter: () => true });
  const r = mockRes();
  await h(post({ order_id: 1001 }, { authorization: 'Bearer good-token' }), r);
  assert.equal(r.statusCode, 409);
  assert.equal(store.orders[0].status, 'paid');
});

// ---------- order lookup ----------
test('order: returns a minimal public summary and rejects bad ids', async () => {
  const { store, h } = await seeded();
  await run(h, sessionEvent('checkout.session.completed'));
  const get = createOrderHandler({ getStore: () => store });
  const ok = mockRes();
  await get({ method: 'GET', headers: {}, query: { session_id: 'cs_test_abcdefghij1234567890' } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json.number, 'FH-1001');
  assert.equal(ok.json.firstName, 'Ada');
  assert.equal(ok.json.total_cents, 7650);
  assert.ok(!ok.body.includes('buyer@x.test') && !ok.body.includes('Fern St') && !ok.body.includes('Lovelace'));
  const bad = mockRes(); await get({ method: 'GET', headers: {}, query: { session_id: "x' or 1=1" } }, bad);
  assert.equal(bad.statusCode, 400);
  const none = mockRes(); await get({ method: 'GET', headers: {}, query: { session_id: 'cs_test_zzzzzzzzzzzzzzzz' } }, none);
  assert.equal(none.statusCode, 404);
  const post405 = mockRes(); await get({ method: 'POST', headers: {} }, post405);
  assert.equal(post405.statusCode, 405);
});
