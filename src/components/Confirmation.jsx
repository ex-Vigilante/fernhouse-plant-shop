import { useEffect, useRef } from 'react';
import { money } from '../data/products.js';
import { Blob } from './bits.jsx';

export default function Confirmation({ order, onDone }) {
  const head = useRef(null);
  useEffect(() => head.current?.focus(), []);

  return (
    <section className="section confirm" aria-labelledby="ok-title">
      <div className="wrap confirm-wrap">
        <Blob className="confirm-blob" />
        <p className="eyebrow">Demo order placed</p>
        <h1 id="ok-title" ref={head} tabIndex={-1}>Thanks, {order.name.split(' ')[0]}. Your demo order is in.</h1>
        <p className="lead">
          Order <strong>{order.number}</strong>. A confirmation would go to <strong>{order.email}</strong>. This is a
          demo store, so no payment was taken and nothing will ship.
        </p>
        <div className="confirm-card">
          <h2>Order summary</h2>
          <ul className="sum-lines plain">
            {order.items.map((l) => (
              <li key={l.id}>
                <span>{l.name}<small>Qty {l.qty}</small></span>
                <span>{money(l.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            <div><dt>{order.shipping.label} shipping</dt><dd>{order.shipCost === 0 ? 'Free' : money(order.shipCost)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{money(order.total)}</dd></div>
          </dl>
          <p className="muted small"><strong>Delivery:</strong> {order.address}. {order.shipping.detail}.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onDone}>Back to the shop</button>
      </div>
    </section>
  );
}
