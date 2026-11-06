import { useRef, useState } from 'react';
import { LIGHT_LABEL, SIZE_LABEL, money } from '../data/products.js';
import { useDialog } from '../hooks.js';
import { AddButton, Img, Stars, Stepper } from './bits.jsx';

export default function QuickView({ product, onClose, onAdd, inCart, onOpenCart }) {
  const ref = useRef(null);
  const [qty, setQty] = useState(1);
  useDialog(!!product, onClose, ref);
  if (!product) return null;
  const p = product;
  const sale = p.compareAt && p.stock > 0;
  const room = Math.max(0, p.stock - inCart);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="qv-title" aria-describedby="qv-desc" tabIndex={-1}>
        <button type="button" className="close" onClick={onClose} aria-label="Close quick view">
          <span aria-hidden="true">&times;</span>
        </button>
        <div className="modal-media">
          <Img src={p.image.replace('w=800', 'w=1000')} alt={p.alt} width={1000} height={1250} eager />
        </div>
        <div className="modal-body">
          <p className="latin">{p.latin}</p>
          <h2 id="qv-title">{p.name}</h2>
          <div className="modal-price">
            <span className={sale ? 'now sale' : 'now'}>{money(p.price)}</span>
            {sale && <s className="was"><span className="sr-only">Was </span>{money(p.compareAt)}</s>}
            <Stars rating={p.rating} reviews={p.reviews} />
          </div>
          <p id="qv-desc">{p.description}</p>
          <dl className="specs">
            <div><dt>Light</dt><dd>{LIGHT_LABEL[p.light]}</dd></div>
            <div><dt>Size</dt><dd>{SIZE_LABEL[p.size]}</dd></div>
            <div><dt>Care</dt><dd>{p.care}</dd></div>
            <div><dt>Pets</dt><dd>{p.petSafe ? 'Safe for cats and dogs' : 'Toxic if chewed'}</dd></div>
          </dl>
          <h3 className="mini-head">How to care for it</h3>
          <p>{p.careNotes}</p>

          {p.stock <= 0 ? (
            <p className="stock-note">Sold out right now.</p>
          ) : (
            <>
              <p className="stock-note">{p.stock <= 5 ? `Only ${p.stock} left` : 'In stock, ships in 1 to 2 days'}</p>
              <div className="buy-row">
                <Stepper value={Math.min(qty, Math.max(room, 1))} min={1} max={Math.max(room, 1)} onChange={setQty} label={p.name} />
                <AddButton product={p} room={room} qty={Math.min(qty, room)} onAdd={onAdd} />
              </div>
              {room === 0 && <p className="stock-note">All available stock is already in your cart.</p>}
              {inCart > 0 && (
                <button type="button" className="link-btn" onClick={onOpenCart}>
                  {inCart} in your cart. View cart
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
