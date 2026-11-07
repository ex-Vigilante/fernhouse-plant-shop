import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { products as demoProducts } from './data/products.js';
import { getSupabase } from './lib/supabase.js';
import { PROD } from './mode.js';
import { MAX_QTY_PER_LINE } from '../shared/pricing.js';

const COLUMNS =
  'id,name,latin,description,care,care_notes,price_cents,compare_at_cents,size,light,pet_safe,rating,reviews,stock,image_url,image_alt,sort';

/** Turns a database row into the shape the shop components already use (prices in dollars). */
export function fromRow(r) {
  return {
    id: r.id,
    name: r.name,
    latin: r.latin || '',
    description: r.description || '',
    care: r.care,
    careNotes: r.care_notes || '',
    price: r.price_cents / 100,
    compareAt: r.compare_at_cents ? r.compare_at_cents / 100 : null,
    size: r.size,
    light: r.light,
    petSafe: !!r.pet_safe,
    rating: Number(r.rating) || 0,
    reviews: r.reviews || 0,
    // one order line can hold at most MAX_QTY_PER_LINE, so never offer more than that
    stock: Math.max(0, Math.min(r.stock, MAX_QTY_PER_LINE)),
    image: r.image_url,
    alt: r.image_alt || r.name,
  };
}

const ProductsContext = createContext(null);
export const useProducts = () => useContext(ProductsContext);

export function ProductsProvider({ children }) {
  const [state, setState] = useState(
    PROD ? { list: [], status: 'loading' } : { list: demoProducts, status: 'ready' }
  );

  const load = useCallback(async () => {
    if (!PROD) return;
    try {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from('products')
        .select(COLUMNS)
        .eq('active', true)
        .order('sort', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      setState({ list: (data || []).map(fromRow), status: 'ready' });
    } catch {
      setState((s) => (s.status === 'ready' ? s : { list: [], status: 'error' }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(
    () => ({
      products: state.list,
      status: state.status,
      byId: Object.fromEntries(state.list.map((p) => [p.id, p])),
      reload: load,
    }),
    [state, load]
  );
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}
