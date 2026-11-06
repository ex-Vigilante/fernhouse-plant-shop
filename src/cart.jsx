import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { byId } from './data/products.js';

const KEY = 'fernhouse-cart-v1';
export const FREE_SHIPPING_AT = 75;

const clamp = (id, qty) => Math.max(0, Math.min(Math.floor(qty) || 0, byId[id]?.stock ?? 0));

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const merged = new Map();
    raw.forEach((l) => {
      if (!l || !byId[l.id]) return;
      merged.set(l.id, (merged.get(l.id) || 0) + (Math.floor(Number(l.qty)) || 0));
    });
    return [...merged].map(([id, qty]) => ({ id, qty: clamp(id, qty) })).filter((l) => l.qty > 0);
  } catch {
    return [];
  }
}

function reducer(state, a) {
  switch (a.type) {
    case 'add': {
      const existing = state.find((l) => l.id === a.id);
      const qty = clamp(a.id, (existing ? existing.qty : 0) + a.qty);
      if (qty <= 0) return state;
      return existing ? state.map((l) => (l.id === a.id ? { ...l, qty } : l)) : [...state, { id: a.id, qty }];
    }
    case 'set': {
      const qty = clamp(a.id, a.qty);
      return qty <= 0 ? state.filter((l) => l.id !== a.id) : state.map((l) => (l.id === a.id ? { ...l, qty } : l));
    }
    case 'remove':
      return state.filter((l) => l.id !== a.id);
    case 'clear':
      return [];
    default:
      return state;
  }
}

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const [lines, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable: cart still works for this session */
    }
  }, [lines]);

  const value = useMemo(() => {
    const items = lines.map((l) => ({ ...l, product: byId[l.id] }));
    return {
      items,
      count: items.reduce((n, l) => n + l.qty, 0),
      subtotal: items.reduce((n, l) => n + l.qty * l.product.price, 0),
      qtyOf: (id) => lines.find((l) => l.id === id)?.qty || 0,
      /** Returns how many units were actually added (0 if at stock limit). */
      add: (id, qty = 1) => {
        const cur = lines.find((l) => l.id === id)?.qty || 0;
        const added = clamp(id, cur + qty) - cur;
        if (added > 0) dispatch({ type: 'add', id, qty: added });
        return Math.max(0, added);
      },
      setQty: (id, qty) => dispatch({ type: 'set', id, qty }),
      remove: (id) => dispatch({ type: 'remove', id }),
      clear: () => dispatch({ type: 'clear' }),
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
