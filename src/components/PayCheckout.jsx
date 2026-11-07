import { useEffect, useRef, useState } from 'react';
import { FREE_SHIPPING_AT, useCart } from '../cart.jsx';
import { money } from '../data/products.js';
import { useProducts } from '../products.jsx';
import { SHIPPING_METHODS, shippingCents } from '../../shared/pricing.js';
import { Img } from './bits.jsx';

/** Production checkout: pick delivery, then hand over to Stripe's hosted payment page. */
export default function PayCheckout({ onBack }) {
  const { items, subtotal } = useCart();
  const { reload } = useProducts();
  const [method, setMethod] = useState('standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
    reload(); // make sure stock and prices are fresh before paying
  }, [reload]);

  const subtotalCents = Math.round(subtotal * 100);
  const shipCents = shippingCents(method, subtotalCents);
  const totalCents = subtotalCents + shipCents;

  const pay = async (e) => {
    e.preventDefault();
    if (busy || !items.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((l) => ({ id: l.id, qty: l.qty })), shipping: method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        if (res.status === 409) reload();
        throw new Error(data.error || 'We could not start checkout. Please try again.');
      }
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected payment address.');
      window.location.assign(url.href);
    } catch (err) {
      setError(err.message || 'We could not start checkout. Please try again.');
      setBusy(false);
    }
  };

  if (!items.length) {
    return (
      <section className="section wrap checkout-empty">
        <h1>Your cart is empty</h1>
        <p>Add a plant or two and come back to check out.</p>
        <button type="button" className="btn btn-primary" onClick={onBack}>Back to the shop</button>
      </section>
    );
  }

  return (
    <section className="section checkout" aria-labelledby="co-title">
      <div className="wrap">
        <button type="button" className="link-btn back" onClick={onBack}>&larr; Back to the shop</button>
        <h1 id="co-title" ref={titleRef} tabIndex={-1}>Checkout</h1>
        <p className="muted">Choose how you would like your plants delivered. You will enter your address and pay on the next page.</p>

        <div className="co-grid">
          <form onSubmit={pay} noValidate>
            {error && <p className="err-summary" role="alert">{error}</p>}
            <fieldset>
              <legend>Delivery method</legend>
              <div className="ship-options">
                {Object.entries(SHIPPING_METHODS).map(([id, s]) => {
                  const cost = shippingCents(id, subtotalCents);
                  return (
                    <label key={id} className={`ship-opt ${method === id ? 'on' : ''}`}>
                      <input type="radio" name="shipping" value={id} checked={method === id} onChange={() => setMethod(id)} />
                      <span>
                        <strong>{s.label}</strong>
                        <small>{s.detail}</small>
                      </span>
                      <span className="ship-price">{cost === 0 ? 'Free' : money(cost / 100)}</span>
                    </label>
                  );
                })}
              </div>
              {subtotal < FREE_SHIPPING_AT && (
                <p className="muted small">Add {money(FREE_SHIPPING_AT - subtotal)} more for free standard shipping.</p>
              )}
            </fieldset>

            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Taking you to Stripe...' : `Continue to payment · ${money(totalCents / 100)}`}
            </button>
            <p className="muted small pay-note">
              Payment is handled on Stripe's secure page. We never see your card details.
            </p>
          </form>

          <aside className="summary" aria-label="Order summary">
            <h2>Order summary</h2>
            <ul className="sum-lines">
              {items.map(({ product: p, qty }) => (
                <li key={p.id}>
                  <div className="line-img"><Img src={p.image} alt="" width={160} height={200} /></div>
                  <span>{p.name}<small>Qty {qty}</small></span>
                  <span>{money(p.price * qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="totals">
              <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
              <div><dt>Shipping</dt><dd>{shipCents === 0 ? 'Free' : money(shipCents / 100)}</dd></div>
              <div className="grand"><dt>Total</dt><dd>{money(totalCents / 100)}</dd></div>
            </dl>
            <p className="muted small">Prices in USD. Final total is confirmed on the payment page.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
