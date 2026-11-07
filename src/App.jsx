import { useEffect, useState } from 'react';
import { CartProvider, useCart } from './cart.jsx';
import { useFilters } from './hooks.js';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import Catalog from './components/Catalog.jsx';
import QuickView from './components/QuickView.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import Checkout from './components/Checkout.jsx';
import Confirmation from './components/Confirmation.jsx';
import { Footer, LightGuide } from './components/Sections.jsx';

function Shop() {
  const cart = useCart();
  const { filters, update, clear, active } = useFilters();
  const [view, setView] = useState('shop'); // shop | checkout | confirmed
  const [quick, setQuick] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [announce, setAnnounce] = useState('');

  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollTo = (id) => {
    const go = () => {
      const el = id === 'top' ? document.body : document.getElementById(id);
      el?.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
    };
    if (view !== 'shop') {
      setView('shop');
      setTimeout(go, 30);
    } else go();
  };

  useEffect(() => {
    if (view !== 'shop') window.scrollTo(0, 0);
  }, [view]);

  const add = (id, qty) => {
    const added = cart.add(id, qty);
    if (added <= 0) {
      setAnnounce('No more of this plant is available to add.');
      return;
    }
    const n = cart.count + added;
    setAnnounce(`Added to cart. ${n} ${n === 1 ? 'item' : 'items'} in your cart.`);
  };

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m.focus(); m.scrollIntoView(); }}>
        Skip to main content
      </a>
      <Header count={cart.count} checkout={view === 'checkout'} onCart={() => setCartOpen(true)} onNav={scrollTo} />
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <main id="main" tabIndex={-1}>
        {view === 'shop' && (
          <>
            <Hero onShop={() => scrollTo('shop')} onLight={() => scrollTo('light')} />
            <Catalog filters={filters} update={update} clear={clear} active={active} onView={setQuick} onAdd={add} />
            <LightGuide
              onPick={(light) => {
                update({ light });
                scrollTo('shop');
              }}
            />
          </>
        )}
        {view === 'checkout' && (
          <Checkout
            onBack={() => setView('shop')}
            onPlaced={(o) => {
              setOrder(o);
              setView('confirmed');
            }}
          />
        )}
        {view === 'confirmed' && order && <Confirmation order={order} onDone={() => setView('shop')} />}
      </main>

      <Footer />

      {quick && (
        <QuickView
          key={quick.id}
          product={quick}
          inCart={cart.qtyOf(quick.id)}
          onClose={() => setQuick(null)}
          onAdd={add}
          onOpenCart={() => {
            setQuick(null);
            setCartOpen(true);
          }}
        />
      )}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onBrowse={() => {
          setCartOpen(false);
          setTimeout(() => scrollTo('shop'), 30);
        }}
        onCheckout={() => {
          setCartOpen(false);
          setView('checkout');
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <Shop />
    </CartProvider>
  );
}
