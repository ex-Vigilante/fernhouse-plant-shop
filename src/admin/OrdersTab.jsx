import { useCallback, useEffect, useState } from 'react';
import { SHIPPING_METHODS } from '../../shared/pricing.js';
import { downloadCsv, ordersToCsv } from './csv.js';

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
// where an order can go next from each status
const NEXT = {
  pending: ['cancelled'],
  paid: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};
const NEXT_LABEL = { shipped: 'Mark as shipped', delivered: 'Mark as delivered', cancelled: 'Cancel order', refunded: 'Mark as refunded' };

const usd = (c) => `$${((c || 0) / 100).toFixed(2)}`;
const when = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

function stripeLink(o) {
  if (!o.stripe_payment_intent) return null;
  const test = (o.stripe_session_id || '').startsWith('cs_test_');
  return `https://dashboard.stripe.com/${test ? 'test/' : ''}payments/${encodeURIComponent(o.stripe_payment_intent)}`;
}

function Detail({ order, sb, onBack, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const a = order.shipping_address;
  const link = stripeLink(order);

  const move = async (status) => {
    const unpaid = order.status === 'pending';
    const msg = unpaid
      ? `Cancel unpaid order FH-${order.id}? Its payment page is closed and the plants go back in stock.`
      : `Mark order FH-${order.id} as ${status}? Money is not moved by this button.`;
    if ((status === 'cancelled' || status === 'refunded') && !window.confirm(msg)) return;
    setBusy(status);
    setError('');
    if (unpaid) {
      // unpaid orders are cancelled on the server: it also closes the Stripe page and restocks
      const { data: auth } = await sb.auth.getSession();
      let ok = false;
      let text = 'The order could not be cancelled.';
      try {
        const res = await fetch('/api/admin-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token || ''}` },
          body: JSON.stringify({ order_id: order.id }),
        });
        ok = res.ok;
        if (!ok) text = (await res.json().catch(() => ({}))).error || text;
      } catch {
        /* network error: keep the default message */
      }
      setBusy('');
      if (!ok) setError(text);
      else onChanged(order.id, 'cancelled');
      return;
    }
    const { data, error: err } = await sb.from('orders').update({ status }).eq('id', order.id).select('id,status');
    setBusy('');
    if (err || !data?.length) {
      setError('The status could not be changed. Your account may not have permission, or the order was removed.');
      return;
    }
    onChanged(order.id, status);
  };

  return (
    <div className="admin-detail">
      <button type="button" className="link-btn back" onClick={onBack}>&larr; All orders</button>
      <h2>Order FH-{order.id} <span className={`pill pill-${order.status}`}>{order.status}</span></h2>
      <p className="muted">Placed {when(order.created_at)}</p>
      {order.payment_conflict && (
        <p className="err-summary conflict" role="alert">
          <strong>Payment conflict.</strong> Money arrived that does not match this order: it was already cancelled, or the
          amount differs from {usd(order.total_cents)}. Open the payment in Stripe and either refund it or contact the customer.
          The plants may not be reserved for this order.
        </p>
      )}
      {error && <p className="err-summary" role="alert">{error}</p>}

      {NEXT[order.status].length > 0 && (
        <div className="admin-actions">
          {NEXT[order.status].map((s) => (
            <button
              key={s}
              type="button"
              className={s === 'shipped' || s === 'delivered' ? 'btn btn-primary' : 'btn btn-outline'}
              disabled={!!busy}
              onClick={() => move(s)}
            >
              {busy === s ? 'Saving...' : NEXT_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      {(order.status === 'cancelled' || order.status === 'refunded' || order.status === 'paid') && (
        <p className="muted small">
          Refunds are issued from the Stripe dashboard. Changing the status here only updates this list. If you cancel a paid order,
          adjust stock on the Products tab.
        </p>
      )}

      <div className="admin-grid">
        <div>
          <h3>Customer</h3>
          <p>
            {order.customer_name || 'Not yet known'}
            <br />{order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : 'No email yet'}
            {order.phone && <><br />{order.phone}</>}
          </p>
        </div>
        <div>
          <h3>Delivery</h3>
          <p>
            {SHIPPING_METHODS[order.shipping_method]?.label || order.shipping_method}
            {a ? (
              <>
                <br />{a.name}
                <br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}
                <br />{a.city}, {a.state} {a.postal_code}
                <br />{a.country}
              </>
            ) : (
              <><br />{order.shipping_method === 'pickup' ? 'Pickup at the greenhouse' : 'No address yet'}</>
            )}
          </p>
        </div>
      </div>

      <h3>Items</h3>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">Plant</th><th scope="col" className="num">Qty</th><th scope="col" className="num">Each</th><th scope="col" className="num">Total</th></tr></thead>
          <tbody>
            {(order.order_items || []).map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td className="num">{i.qty}</td>
                <td className="num">{usd(i.unit_price_cents)}</td>
                <td className="num">{usd(i.unit_price_cents * i.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="totals admin-totals">
        <div><dt>Subtotal</dt><dd>{usd(order.subtotal_cents)}</dd></div>
        <div><dt>Shipping</dt><dd>{order.shipping_cents ? usd(order.shipping_cents) : 'Free'}</dd></div>
        <div className="grand"><dt>Total</dt><dd>{usd(order.total_cents)}</dd></div>
      </dl>
      {link ? (
        <p><a href={link} target="_blank" rel="noopener noreferrer">View payment in Stripe<span className="sr-only"> (opens in a new tab)</span></a></p>
      ) : (
        <p className="muted small">No payment recorded for this order.</p>
      )}
    </div>
  );
}

const PAGE = 50;
const FILTERS = [
  { id: 'default', label: 'Paid, shipped, delivered, refunded' },
  { id: 'all', label: 'All orders (incl. unpaid and cancelled)' },
  ...STATUSES.map((s) => ({ id: s, label: s[0].toUpperCase() + s.slice(1) })),
];

function query(sb, filter) {
  let q = sb
    .from('orders')
    .select('*, order_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (filter === 'default') q = q.not('status', 'in', '(pending,cancelled)');
  else if (filter !== 'all') q = q.eq('status', filter);
  return q;
}

export default function OrdersTab({ sb }) {
  const [orders, setOrders] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('default');
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (from = 0) => {
    setError('');
    const { data, error: err, count } = await query(sb, filter).range(from, from + PAGE - 1);
    if (err) {
      setError('Orders could not be loaded.');
      return;
    }
    setOrders((cur) => (from === 0 ? data : [...(cur || []), ...data]));
    setTotal(count ?? data.length);
  }, [sb, filter]);

  useEffect(() => {
    setOrders(null);
    load(0);
  }, [load]);

  const shown = orders || [];
  const hasMore = orders !== null && orders.length < total;

  // exports everything that matches the current filter, fetched page by page
  const exportCsv = async () => {
    setExporting(true);
    setError('');
    const all = [];
    for (let from = 0; ; from += 200) {
      const { data, error: err } = await query(sb, filter).range(from, from + 199);
      if (err) {
        setError('The export failed. Please try again.');
        setExporting(false);
        return;
      }
      all.push(...data);
      if (data.length < 200) break;
    }
    downloadCsv(`fernhouse-orders-${filter}-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsv(all));
    setExporting(false);
  };

  const open = shown.find((o) => o.id === openId);
  if (open) {
    return (
      <Detail
        order={open}
        sb={sb}
        onBack={() => setOpenId(null)}
        onChanged={(id, status) => setOrders((list) => list.map((o) => (o.id === id ? { ...o, status } : o)))}
      />
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <div className="field">
          <label htmlFor="o-filter">Show</label>
          <select id="o-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => load(0)}>Refresh</button>
        <button type="button" className="btn btn-outline" disabled={!shown.length || exporting} onClick={exportCsv}>
          {exporting ? 'Preparing...' : 'Export CSV'}
        </button>
      </div>
      {error && <p className="err-summary" role="alert">{error}</p>}
      {orders === null && !error && <p role="status">Loading orders...</p>}
      {orders && (
        <p className="result-count" role="status" aria-live="polite">
          {total === 1 ? '1 order' : `${total} orders`}{hasMore ? `, showing the newest ${shown.length}` : ''}
        </p>
      )}
      {orders && shown.length === 0 && <div className="empty"><p>No orders here yet.</p></div>}
      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Order</th><th scope="col">Placed</th><th scope="col">Customer</th>
                <th scope="col">Status</th><th scope="col" className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id}>
                  <th scope="row">
                    <button type="button" className="link-btn" onClick={() => setOpenId(o.id)}>
                      FH-{o.id}<span className="sr-only"> view details</span>
                    </button>
                    {o.payment_conflict && <span className="pill pill-warn">Payment conflict</span>}
                  </th>
                  <td>{when(o.created_at)}</td>
                  <td>{o.customer_name || <span className="muted">Not paid yet</span>}</td>
                  <td><span className={`pill pill-${o.status}`}>{o.status}</span></td>
                  <td className="num">{usd(o.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <p className="load-more"><button type="button" className="btn btn-outline" onClick={() => load(shown.length)}>Load more</button></p>
      )}
    </div>
  );
}
