import { lazy, Suspense, useEffect, useState } from 'react';
import { CartProvider, useCart } from './cart.jsx';
import { ProductsProvider, useProducts } from './products.jsx';
import { useFilters } from './hooks.js';
import { DEFAULT_TITLE, useDocumentMeta, useProductJsonLd } from './meta.js';
import { PROD } from './mode.js';
import { navigate, useRoute } from './router.jsx';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import Catalog from './components/Catalog.jsx';
import QuickView from './components/QuickView.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import Checkout from './components/Checkout.jsx';
import PayCheckout from './components/PayCheckout.jsx';
import Confirmation from './components/Confirmation.jsx';
import OrderSuccess from './components/OrderSuccess.jsx';
import { NotFound, Privacy, ShippingReturns, Terms } from './components/Pages.jsx';
import { Footer, LightGuide } from './components/Sections.jsx';

const Admin = lazy(() => import('./admin/Admin.jsx'));

const PAGES = {
  '/shipping-returns': {
    title: 'Shipping and returns - Fernhouse Plant Co.',
    description: 'How Fernhouse ships live plants from Portland, Oregon, what it costs, and our 30-day plant guarantee.',
    View: ShippingReturns,
  },
  '/privacy': {
    title: 'Privacy policy - Fernhouse Plant Co.',
    description: 'What Fernhouse Plant Co. collects when you order, how it is used, and your choices.',
    View: Privacy,
  },
  '/terms': {
    title: 'Terms of sale - Fernhouse Plant Co.',
    description: 'The terms that apply to orders placed with Fernhouse Plant Co. in Portland, Oregon.',
    View: Terms,
  },
  ...(PROD
    ? {
        '/order/success': {
          title: 'Order confirmed - Fernhouse Plant Co.',
          description: 'Your Fernhouse order.',
          View: OrderSuccess,
          noindex: true,
        },
      }
    : {}),
};

function Shop({ path }) {
  const cart = useCart();
  const { products } = useProducts();
  const { filters, update, clear, active } = useFilters();
  const [view, setView] = useState('shop'); // shop | checkout | confirmed (confirmed is demo only)
  const [quick, setQuick] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [announce, setAnnounce] = useState('');
  // read once, before the filters hook tidies the address bar
  const [toast, setToast] = useState(() =>
    PROD && new URLSearchParams(window.location.search).get('checkout') === 'cancelled'
      ? 'Checkout was cancelled. Your cart is saved.'
      : ''
  );

  const page = PAGES[path];
  const onShop = path === '/';
  useDocumentMeta(
    page
      ? { title: page.title, description: page.description, noindex: page.noindex }
      : onShop
        ? { title: DEFAULT_TITLE }
        : { title: 'Page not found - Fernhouse Plant Co.', noindex: true }
  );
  useProductJsonLd(products);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollTo = (id) => {
    const go = () => {
      const el = id === 'top' ? document.body : document.getElementById(id);
      el?.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
    };
    if (view !== 'shop' || !onShop) {
      setView('shop');
      if (!onShop) navigate('/');
      setTimeout(go, 60);
    } else go();
  };

  useEffect(() => {
    if (view !== 'shop' || !onShop) window.scrollTo(0, 0);
  }, [view, onShop]);

  const add = (id, qty) => {
    const added = cart.add(id, qty);
    if (added <= 0) {
      setAnnounce('No more of this plant is available to add.');
      return;
    }
    const n = cart.count + added;
    setAnnounce(`Added to cart. ${n} ${n === 1 ? 'item' : 'items'} in your cart.`);
  };

  const Checkout_ = PROD ? PayCheckout : Checkout;
  const Page = page?.View;

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m.focus(); m.scrollIntoView(); }}>
        Skip to main content
      </a>
      <Header count={cart.count} checkout={onShop && view === 'checkout'} onCart={() => setCartOpen(true)} onNav={scrollTo} />
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="link-btn" onClick={() => setToast('')}>Dismiss</button>
        </div>
      )}

      <main id="main" tabIndex={-1}>
        {Page ? (
          <Page />
        ) : !onShop ? (
          <NotFound />
        ) : (
          <>
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
              <Checkout_
                onBack={() => setView('shop')}
                onPlaced={(o) => {
                  setOrder(o);
                  setView('confirmed');
                }}
              />
            )}
            {view === 'confirmed' && order && <Confirmation order={order} onDone={() => setView('shop')} />}
          </>
        )}
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
          if (!onShop) navigate('/');
        }}
      />
    </>
  );
}

export default function App() {
  const path = useRoute();
  if (PROD && path === '/admin') {
    return (
      <Suspense fallback={<p className="wrap section" role="status">Loading...</p>}>
        <Admin />
      </Suspense>
    );
  }
  return (
    <ProductsProvider>
      <CartProvider>
        <Shop path={path} />
      </CartProvider>
    </ProductsProvider>
  );
}
