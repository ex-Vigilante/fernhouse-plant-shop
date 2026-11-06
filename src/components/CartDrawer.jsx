import { useRef } from 'react';
import { FREE_SHIPPING_AT, useCart } from '../cart.jsx';
import { money } from '../data/products.js';
import { useDialog } from '../hooks.js';
import { Img, Leaf, Stepper } from './bits.jsx';

export default function CartDrawer({ open, onClose, onCheckout, onBrowse }) {
  const ref = useRef(null);
  const { items, subtotal, count, setQty, remove } = useCart();
  useDialog(open, onClose, ref);
  if (!open) return null;

  const left = Math.max(0, FREE_SHIPPING_AT - subtotal);
  const pct = Math.min(100, (subtotal / FREE_SHIPPING_AT) * 100);

  return (
    <div className="overlay overlay-right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabIndex={-1}>
        <div className="drawer-head">
          <h2 id="cart-title">Your cart {count > 0 && <span className="muted">({count})</span>}</h2>
          <button type="button" className="close close-inline" onClick={onClose} aria-label="Close cart">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="drawer-empty">
            <Leaf className="empty-leaf" />
            <p><strong>Nothing here yet.</strong></p>
            <p>Plants you add will wait here, even if you close the tab.</p>
            <button type="button" className="btn btn-primary" onClick={onBrowse}>Browse plants</button>
          </div>
        ) : (
          <>
            <div className="ship-meter">
              <p aria-live="polite">
                {left > 0 ? (
                  <>You are <strong>{money(left)}</strong> away from free shipping</>
                ) : (
                  <strong>Free standard shipping unlocked</strong>
                )}
              </p>
              <div className="bar" role="progressbar" aria-label="Progress to free shipping" aria-valuemin={0} aria-valuemax={FREE_SHIPPING_AT} aria-valuenow={Math.min(subtotal, FREE_SHIPPING_AT)} aria-valuetext={`${money(Math.min(subtotal, FREE_SHIPPING_AT))} of ${money(FREE_SHIPPING_AT)}`}>
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>

            <ul className="lines">
              {items.map(({ product: p, qty }) => (
                <li key={p.id} className="line">
                  <div className="line-img"><Img src={p.image} alt="" width={160} height={200} /></div>
                  <div className="line-info">
                    <p className="line-name">{p.name}</p>
                    <p className="muted">{money(p.price)} each</p>
                    <div className="line-actions">
                      <Stepper value={qty} min={1} max={p.stock} onChange={(n) => setQty(p.id, n)} label={p.name} />
                      <button type="button" className="link-btn" onClick={() => remove(p.id)} aria-label={`Remove ${p.name} from cart`}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="line-total">{money(p.price * qty)}</p>
                </li>
              ))}
            </ul>

            <div className="drawer-foot">
              <p className="subtotal"><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
              <p className="muted small">Shipping is calculated at checkout.</p>
              <button type="button" className="btn btn-primary btn-block" onClick={onCheckout}>Go to checkout</button>
              <button type="button" className="link-btn center" onClick={onClose}>Keep shopping</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
