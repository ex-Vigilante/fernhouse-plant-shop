import { useEffect, useRef, useState } from 'react';
import { Leaf } from './bits.jsx';

export default function Header({ count, onCart, onNav, checkout }) {
  const [bump, setBump] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    setBump(true);
    const t = setTimeout(() => setBump(false), 400);
    return () => clearTimeout(t);
  }, [count]);

  const go = (id) => (e) => {
    e.preventDefault();
    onNav(id);
  };

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a className="wordmark" href="#top" onClick={go('top')} aria-label="Fernhouse Plant Co. home">
          <Leaf className="wordmark-leaf" />
          <span>Fernhouse</span>
        </a>
        <nav aria-label="Main">
          <ul className="nav-list">
            <li><a href="#shop" onClick={go('shop')}>Shop</a></li>
            <li><a href="#light" onClick={go('light')}>Light guide</a></li>
          </ul>
        </nav>
        <button type="button" className="cart-btn" onClick={onCart} aria-haspopup="dialog" aria-label={`Open cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M5 8h14l-1.2 11H6.2L5 8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className={`badge ${bump ? 'bump' : ''}`} aria-hidden="true">{count}</span>
        </button>
      </div>
      {checkout && <span className="sr-only">You are in checkout</span>}
    </header>
  );
}
