import { useEffect, useRef, useState } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Focus trap + Esc to close + focus return + scroll lock for dialogs. */
export function useDialog(open, onClose, ref) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || !ref.current) return undefined;
    const node = ref.current;
    const previous = document.activeElement;
    const focusables = () =>
      [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    (node.querySelector('[data-autofocus]') || focusables()[0] || node).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === 'Tab') {
        const list = focusables();
        if (!list.length) {
          e.preventDefault();
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const bar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (bar > 0) document.body.style.paddingRight = `${bar}px`;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      if (previous && previous.focus && document.contains(previous)) previous.focus();
    };
  }, [open, ref]);
}

export function useDebouncedCallback(fn, delay) {
  const timer = useRef();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = (...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  };
  run.cancel = () => clearTimeout(timer.current);
  return run;
}

export const DEFAULT_FILTERS = { q: '', light: '', pet: false, size: '', price: '', sort: 'featured' };

const readFilters = () => {
  const p = new URLSearchParams(window.location.search);
  const pick = (key, allowed) => (allowed.includes(p.get(key)) ? p.get(key) : DEFAULT_FILTERS[key]);
  return {
    q: (p.get('q') || '').slice(0, 60),
    light: pick('light', ['low', 'medium', 'bright']),
    pet: p.get('pet') === '1',
    size: pick('size', ['S', 'M', 'L']),
    price: pick('price', ['u40', '40-80', 'o80']),
    sort: pick('sort', ['price-asc', 'price-desc', 'name']),
  };
};

/** Filter state mirrored into the URL query string (shareable links). */
export function useFilters() {
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, ...readFilters() }));

  useEffect(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === DEFAULT_FILTERS[k]) return;
      p.set(k, v === true ? '1' : v);
    });
    const qs = p.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState(null, '', url);
  }, [filters]);

  useEffect(() => {
    const onPop = () => setFilters({ ...DEFAULT_FILTERS, ...readFilters() });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const clear = () => setFilters({ ...DEFAULT_FILTERS });
  const active =
    filters.q || filters.light || filters.pet || filters.size || filters.price ? true : false;
  return { filters, update, clear, active };
}
