import { useEffect, useRef, useState } from 'react';

export function Leaf({ className = '', style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <path d="M60 112C18 92 8 48 28 12c40 4 78 30 32 100z" fill="currentColor" />
      <path d="M60 108C48 80 40 56 30 20" stroke="#F7F4EE" strokeOpacity=".55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Blob({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M45 20c30-22 82-14 108 14s30 70 8 104-66 52-100 38S4 130 6 90 15 42 45 20z" />
    </svg>
  );
}

export function Img({ src, alt, width = 800, height = 1000, eager = false }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="img-frame">
      {!failed && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {failed && <Leaf className="img-fallback" />}
    </span>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Decrease quantity of ${label}`}>
        &minus;
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Increase quantity of ${label}`}>
        +
      </button>
    </div>
  );
}

/** Button that flips to "Added" for a moment after a successful add. */
export function AddButton({ product, onAdd, qty = 1, room = product.stock, className = '' }) {
  const [done, setDone] = useState(false);
  const t = useRef();
  useEffect(() => () => clearTimeout(t.current), []);
  const soldOut = product.stock <= 0;
  const maxed = !soldOut && room <= 0;
  return (
    <button
      type="button"
      className={`btn btn-primary ${done ? 'is-added' : ''} ${className}`}
      disabled={soldOut || maxed}
      onClick={() => {
        onAdd(product.id, qty);
        setDone(true);
        clearTimeout(t.current);
        t.current = setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? 'Added to cart' : soldOut ? 'Sold out' : maxed ? 'Max in cart' : 'Add to cart'}
    </button>
  );
}

export function Stars({ rating, reviews }) {
  return (
    <span className="stars">
      <span className="sr-only">Rated {rating.toFixed(1)} out of 5 from {reviews} reviews</span>
      <span aria-hidden="true">&#9733; {rating.toFixed(1)}</span>
      <span className="stars-count" aria-hidden="true">({reviews})</span>
    </span>
  );
}
