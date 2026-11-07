import { useEffect, useRef, useState } from 'react';
import { useCart } from '../cart.jsx';
import { money } from '../data/products.js';
import { SHIPPING_METHODS } from '../../shared/pricing.js';
import { Link } from '../router.jsx';
import { Blob } from './bits.jsx';

const cents = (n) => money(n / 100);

/** Thank-you page shown after Stripe sends the customer back. Reads the order from /api/order. */
export default function OrderSuccess() {
  const { clear } = useCart();
  const head = useRef(null);
  const [state, setState] = useState({ phase: 'loading' });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session_id');
    if (!id) {
      setState({ phase: 'missing' });
      return undefined;
    }
    let stop = false;
    let timer;
    let tries = 0;
    const run = async () => {
      try {
        const res = await fetch(`/api/order?session_id=${encodeURIComponent(id)}`);
        if (res.status === 404 || res.status === 400) throw new Error('missing');
        if (!res.ok) throw new Error('server');
        const order = await res.json();
        if (stop) return;
        setState({ phase: 'ready', order });
        // the webhook can land a moment after the redirect, so wait for "paid"
        if (order.status === 'pending' && ++tries < 20) timer = setTimeout(run, 2000);
      } catch (e) {
        if (stop) return;
        if (e.message === 'missing') setState({ phase: 'missing' });
        else if (++tries < 5) timer = setTimeout(run, 2500);
        else setState({ phase: 'error' });
      }
    };
    run();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  const order = state.phase === 'ready' ? state.order : null;
  const paid = order && ['paid', 'shipped', 'delivered'].includes(order.status);

  useEffect(() => {
    if (paid) clear(); // the order is placed, so the cart is done
  }, [paid, clear]);

  useEffect(() => {
    if (state.phase !== 'loading') head.current?.focus();
  }, [state.phase, paid]);

  if (state.phase === 'loading') {
    return (
      <section className="section confirm" aria-busy="true">
        <div className="wrap confirm-wrap"><p role="status">Checking your order...</p></div>
      </section>
    );
  }

  if (state.phase === 'missing' || state.phase === 'error') {
    return (
      <section className="section confirm" aria-labelledby="ok-title">
        <div className="wrap confirm-wrap">
          <h1 id="ok-title" ref={head} tabIndex={-1}>{state.phase === 'missing' ? 'We could not find that order' : 'We could not load your order'}</h1>
          <p className="lead">
            {state.phase === 'missing'
              ? 'The link may be incomplete. If you have just paid, check your email for a receipt.'
              : 'Please refresh in a moment. If you have just paid, your order is safe and a receipt is on its way.'}
          </p>
          <Link to="/" className="btn btn-primary">Back to the shop</Link>
        </div>
      </section>
    );
  }

  const cancelled = order.status === 'cancelled' || order.status === 'refunded';
  return (
    <section className="section confirm" aria-labelledby="ok-title">
      <div className="wrap confirm-wrap">
        <Blob className="confirm-blob" />
        <p className="eyebrow">{paid ? 'Order confirmed' : cancelled ? 'Order not completed' : 'Almost there'}</p>
        <h1 id="ok-title" ref={head} tabIndex={-1}>
          {paid
            ? `Thanks${order.firstName ? `, ${order.firstName}` : ''}. Your order is in.`
            : cancelled
              ? 'This checkout was not completed'
              : 'We are confirming your payment'}
        </h1>
        <p className="lead">
          Order <strong>{order.number}</strong>.{' '}
          {paid
            ? 'We will email you when your plants ship. Keep this number if you need to contact us.'
            : cancelled
              ? 'No payment was taken for it. Your cart is still saved if you would like to try again.'
              : 'This usually takes a few seconds. You can close this page; your order is safe.'}
        </p>
        <div className="confirm-card">
          <h2>Order summary</h2>
          <ul className="sum-lines plain">
            {order.items.map((l, i) => (
              <li key={`${l.name}-${i}`}>
                <span>{l.name}<small>Qty {l.qty}</small></span>
                <span>{cents(l.unit_price_cents * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{cents(order.subtotal_cents)}</dd></div>
            <div>
              <dt>{SHIPPING_METHODS[order.shipping_method]?.label || 'Shipping'}</dt>
              <dd>{order.shipping_cents === 0 ? 'Free' : cents(order.shipping_cents)}</dd>
            </div>
            <div className="grand"><dt>Total</dt><dd>{cents(order.total_cents)}</dd></div>
          </dl>
        </div>
        <Link to="/" className="btn btn-primary">Back to the shop</Link>
      </div>
    </section>
  );
}
