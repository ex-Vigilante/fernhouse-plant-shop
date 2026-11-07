import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { useProducts } from './products.jsx';
import { FREE_SHIPPING_CENTS, MAX_QTY_PER_LINE } from '../shared/pricing.js';

const KEY = 'fernhouse-cart-v1';
export const FREE_SHIPPING_AT = FREE_SHIPPING_CENTS / 100;

const clamp = (product, qty) => Math.max(0, Math.min(Math.floor(qty) || 0, product?.stock ?? 0));

/** Reads saved lines. Only the shape is checked here; products may still be loading. */
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const merged = new Map();
    raw.forEach((l) => {
      if (!l || typeof l.id !== 'string' || l.id.length > 60) return;
      const n = Math.floor(Number(l.qty)) || 0;
      if (n > 0) merged.set(l.id, Math.min(MAX_QTY_PER_LINE, (merged.get(l.id) || 0) + n));
    });
    return [...merged].map(([id, qty]) => ({ id, qty }));
  } catch {
    return [];
  }
}

function reducer(state, a) {
  switch (a.type) {
    case 'add': {
      const cur = state.find((l) => l.id === a.id)?.qty || 0;
      const qty = clamp(a.product, cur + a.qty);
      if (qty <= cur) return state;
      return cur ? state.map((l) => (l.id === a.id ? { ...l, qty } : l)) : [...state, { id: a.id, qty }];
    }
    case 'set': {
      if (a.qty <= 0) return state.filter((l) => l.id !== a.id);
      return state.some((l) => l.id === a.id)
        ? state.map((l) => (l.id === a.id ? { ...l, qty: a.qty } : l))
        : [...state, { id: a.id, qty: a.qty }];
    }
    case 'remove':
      return state.filter((l) => l.id !== a.id);
    case 'sync': {
      // drop plants that no longer exist and trim quantities to current stock
      const next = state
        .map((l) => ({ id: l.id, qty: clamp(a.byId[l.id], l.qty) }))
        .filter((l) => l.qty > 0);
      const same = next.length === state.length && next.every((l, i) => l.id === state[i].id && l.qty === state[i].qty);
      return same ? state : next;
    }
    case 'clear':
      return state.length ? [] : state;
    default:
      return state;
  }
}

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const { byId, status } = useProducts();
  const [lines, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    if (status === 'ready') dispatch({ type: 'sync', byId });
  }, [byId, status]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable: cart still works for this session */
    }
  }, [lines]);

  const value = useMemo(() => {
    const items = lines
      .map((l) => ({ id: l.id, product: byId[l.id], qty: clamp(byId[l.id], l.qty) }))
      .filter((l) => l.product && l.qty > 0);
    const cents = items.reduce((n, l) => n + l.qty * Math.round(l.product.price * 100), 0);
    return {
      items,
      count: items.reduce((n, l) => n + l.qty, 0),
      subtotal: cents / 100,
      qtyOf: (id) => items.find((l) => l.id === id)?.qty || 0,
      /** Returns how many units were actually added (0 if at stock limit). */
      add: (id, qty = 1) => {
        const cur = items.find((l) => l.id === id)?.qty || 0;
        const added = clamp(byId[id], cur + qty) - cur;
        if (added > 0) dispatch({ type: 'add', id, qty: added, product: byId[id] });
        return Math.max(0, added);
      },
      setQty: (id, qty) => dispatch({ type: 'set', id, qty: clamp(byId[id], qty) }),
      remove: (id) => dispatch({ type: 'remove', id }),
      clear: () => dispatch({ type: 'clear' }),
    };
  }, [lines, byId]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
