// Database access for the API functions. Uses the service-role key, so it only ever runs on the server.
import { createClient } from '@supabase/supabase-js';

export function createServiceClient(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const fail = (error, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/** The small set of database calls the API needs. Tests swap this for an in-memory fake. */
export function createStore(sb) {
  return {
    async getProductsByIds(ids) {
      const { data, error } = await sb
        .from('products')
        .select('id,name,price_cents,stock,active,image_url')
        .in('id', ids);
      fail(error, 'load products');
      return Object.fromEntries((data || []).map((p) => [p.id, p]));
    },

    /** Creates the order and reserves stock atomically. Throws an error with code "stock" if any plant is short. */
    async createPendingOrder({ method, subtotal, shipping, total, lines }) {
      const { data, error } = await sb.rpc('create_pending_order', {
        p_shipping_method: method,
        p_subtotal: subtotal,
        p_shipping: shipping,
        p_total: total,
        p_items: lines.map((l) => ({
          product_id: l.id,
          name: l.name,
          unit_price_cents: l.unit_price_cents,
          qty: l.qty,
        })),
      });
      if (error && /insufficient_stock/.test(error.message || '')) {
        throw Object.assign(new Error('insufficient stock'), { code: 'stock' });
      }
      fail(error, 'create order');
      return data;
    },

    async attachSession(orderId, sessionId) {
      const { error } = await sb.from('orders').update({ stripe_session_id: sessionId }).eq('id', orderId);
      fail(error, 'save session');
    },

    async getOrderForCancel(orderId) {
      const { data, error } = await sb.from('orders').select('id,status,stripe_session_id').eq('id', orderId).maybeSingle();
      fail(error, 'load order');
      return data;
    },

    /**
     * Cancels an UNPAID order and puts its reserved plants back. Safe to repeat: only a pending order
     * is cancelled, and the database releases stock once, and only for a cancelled order.
     * Returns the order id (looked up by session when only that is known), or null.
     */
    async cancelAndRelease({ orderId, sessionId }) {
      let id = orderId || null;
      if (!id && sessionId) {
        const found = await this.findOrderIdBySession(sessionId);
        id = found;
      }
      if (!id) return null;
      const { error } = await sb.from('orders').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending');
      fail(error, 'cancel order');
      const { error: relErr } = await sb.rpc('release_stock', { p_order_id: id });
      fail(relErr, 'release stock');
      return id;
    },

    /**
     * Records a payment. result is "paid" (was pending, now paid), "duplicate" (already paid, a retry),
     * "conflict" (order was cancelled or refunded: contact details are still saved and payment_conflict
     * is set) or "unknown" (no such order).
     */
    async recordPayment({ orderId, sessionId, paymentIntent, email, name, phone, address }) {
      const contact = {
        stripe_session_id: sessionId,
        stripe_payment_intent: paymentIntent,
        email,
        customer_name: name,
        phone,
        shipping_address: address,
      };
      const by = (q) => (orderId ? q.eq('id', orderId) : q.eq('stripe_session_id', sessionId));

      const paid = await by(sb.from('orders').update({ status: 'paid', ...contact }).eq('status', 'pending')).select('id,total_cents,currency');
      fail(paid.error, 'mark paid');
      if (paid.data?.length) {
        const o = paid.data[0];
        return { result: 'paid', orderId: o.id, total_cents: o.total_cents, currency: o.currency };
      }

      const cur = await by(sb.from('orders').select('id,status')).maybeSingle();
      fail(cur.error, 'find order');
      if (!cur.data) return { result: 'unknown', orderId: null };
      if (['paid', 'shipped', 'delivered'].includes(cur.data.status)) return { result: 'duplicate', orderId: cur.data.id };

      const { error } = await sb.from('orders').update({ ...contact, payment_conflict: true }).eq('id', cur.data.id);
      fail(error, 'record conflicting payment');
      return { result: 'conflict', orderId: cur.data.id };
    },

    async flagConflict(orderId) {
      const { error } = await sb.from('orders').update({ payment_conflict: true }).eq('id', orderId);
      fail(error, 'flag order');
    },

    async findOrderIdBySession(sessionId) {
      const { data, error } = await sb.from('orders').select('id').eq('stripe_session_id', sessionId).maybeSingle();
      fail(error, 'find order');
      return data?.id ?? null;
    },

    /** Resolves a signed-in user from their access token and says whether they are a confirmed admin. */
    async adminFromToken(token) {
      const { data, error } = await sb.auth.getUser(token);
      const u = data?.user;
      if (error || !u?.email || !u.email_confirmed_at) return null;
      const { data: row, error: e2 } = await sb.from('admins').select('email').eq('email', u.email.toLowerCase()).maybeSingle();
      fail(e2, 'check admin');
      return row ? { id: u.id, email: u.email } : null;
    },

    async getOrderBySession(sessionId) {
      const { data, error } = await sb
        .from('orders')
        .select('id,status,customer_name,shipping_method,subtotal_cents,shipping_cents,total_cents,currency,order_items(name,qty,unit_price_cents)')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();
      fail(error, 'load order');
      return data;
    },
  };
}
