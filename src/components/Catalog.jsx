import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../cart.jsx';
import { products, LIGHT_LABEL, SIZE_LABEL, money } from '../data/products.js';
import { useDebouncedCallback } from '../hooks.js';
import { AddButton, Img, Leaf, Stars } from './bits.jsx';

const PRICE_RANGES = {
  u40: (p) => p < 40,
  '40-80': (p) => p >= 40 && p <= 80,
  o80: (p) => p > 80,
};

export function applyFilters(list, f) {
  const q = f.q.trim().toLowerCase();
  const out = list.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q) || p.latin.toLowerCase().includes(q)) &&
      (!f.light || p.light === f.light) &&
      (!f.pet || p.petSafe) &&
      (!f.size || p.size === f.size) &&
      (!f.price || PRICE_RANGES[f.price](p.price))
  );
  const sorts = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return sorts[f.sort] ? [...out].sort(sorts[f.sort]) : out;
}

function Card({ p, onView, onAdd }) {
  const { qtyOf } = useCart();
  const sale = p.compareAt && p.stock > 0;
  const status = [p.stock <= 0 && 'sold out', sale && 'on sale', p.petSafe && 'pet-safe'].filter(Boolean).join(', ');
  return (
    <li className="card">
      <button type="button" className="card-media" onClick={() => onView(p)} aria-label={`Quick view: ${p.name}${status ? ` (${status})` : ''}`}>
        <Img src={p.image} alt={p.alt} />
        <span className="tags">
          {p.stock <= 0 && <span className="tag tag-out">Sold out</span>}
          {sale && <span className="tag tag-sale">Sale</span>}
          {p.petSafe && <span className="tag tag-pet">Pet-safe</span>}
        </span>
      </button>
      <div className="card-body">
        <h3>{p.name}</h3>
        <p className="latin">{p.latin}</p>
        <p className="meta">
          {LIGHT_LABEL[p.light]} &middot; {SIZE_LABEL[p.size]} &middot; {p.care} care
        </p>
        <div className="card-foot">
          <p className="price">
            <span className={sale ? 'now sale' : 'now'}>{money(p.price)}</span>
            {sale && (
              <>
                {' '}
                <s className="was"><span className="sr-only">Was </span>{money(p.compareAt)}</s>
              </>
            )}
          </p>
          <Stars rating={p.rating} reviews={p.reviews} />
        </div>
        <AddButton product={p} room={p.stock - qtyOf(p.id)} onAdd={onAdd} className="btn-block" />
      </div>
    </li>
  );
}

export default function Catalog({ filters, update, clear, active, onView, onAdd }) {
  const [text, setText] = useState(filters.q);
  const pushQ = useDebouncedCallback((v) => update({ q: v }), 250);

  // keep the box in sync when filters change from elsewhere (clear, back button, light guide)
  useEffect(() => setText(filters.q), [filters.q]);

  const clearAll = () => {
    pushQ.cancel();
    setText('');
    clear();
  };

  const results = useMemo(() => applyFilters(products, filters), [filters]);

  return (
    <section id="shop" className="section shop" aria-labelledby="shop-title">
      <div className="wrap">
        <div className="section-head">
          <h2 id="shop-title">The plant shelf</h2>
          <p>Sixteen plants we grow on or source from small Oregon nurseries. Narrow them down below.</p>
        </div>

        <form className="filters" role="search" aria-label="Filter plants" onSubmit={(e) => e.preventDefault()}>
          <div className="field field-search">
            <label htmlFor="f-q">Search</label>
            <input
              id="f-q"
              type="search"
              placeholder="Name or Latin name"
              value={text}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => {
                setText(e.target.value);
                pushQ(e.target.value);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="f-light">Light</label>
            <select id="f-light" value={filters.light} onChange={(e) => update({ light: e.target.value })}>
              <option value="">Any light</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="bright">Bright</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-size">Size</label>
            <select id="f-size" value={filters.size} onChange={(e) => update({ size: e.target.value })}>
              <option value="">Any size</option>
              <option value="S">Small</option>
              <option value="M">Medium</option>
              <option value="L">Large</option>
            </select>
          </div>
          <label className="toggle" htmlFor="f-pet">
            <input id="f-pet" type="checkbox" checked={filters.pet} onChange={(e) => update({ pet: e.target.checked })} />
            <span className="toggle-ui" aria-hidden="true" />
            <span>Pet-safe only</span>
          </label>
        </form>

        <div className="result-bar">
          <p className="result-count" role="status" aria-live="polite">
            {results.length === 1 ? '1 plant' : `${results.length} plants`}
            {active ? (results.length === 1 ? ' matches your filters' : ' match your filters') : ''}
          </p>
          {active && (
            <button type="button" className="link-btn" onClick={clearAll}>
              Clear filters
            </button>
          )}
        </div>

        {results.length > 0 ? (
          <ul className="grid">
            {results.map((p) => (
              <Card key={p.id} p={p} onView={onView} onAdd={onAdd} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <Leaf className="empty-leaf" />
            <h3>No plants match that combination</h3>
            <p>Try a wider price range, or drop the pet-safe or size filter. Large pet-safe plants are rare, for example.</p>
            <button type="button" className="btn btn-primary" onClick={clearAll}>Clear filters</button>
          </div>
        )}
      </div>
    </section>
  );
}
