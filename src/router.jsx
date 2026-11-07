import { useEffect, useState } from 'react';

// Tiny router. On Vercel (base "/") pages have real paths like /privacy.
// On GitHub Pages (base "/fernhouse-plant-shop/") pages live in the hash (#/privacy), because
// Pages cannot rewrite unknown paths back to index.html.
const BASE = import.meta.env.BASE_URL;
export const PATH_ROUTING = BASE === '/';

export function currentPath() {
  if (PATH_ROUTING) return window.location.pathname.replace(/\/+$/, '') || '/';
  const h = window.location.hash;
  return h.startsWith('#/') ? h.slice(1).split('?')[0].replace(/\/+$/, '') || '/' : '/';
}

export const toHref = (path) => (PATH_ROUTING ? path : `${BASE}#${path}`);

export function navigate(path) {
  if (PATH_ROUTING) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('app:navigate'));
  } else {
    window.location.hash = path;
  }
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('app:navigate', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('app:navigate', sync);
    };
  }, []);
  return path;
}

export function Link({ to, children, onClick, ...rest }) {
  return (
    <a
      href={toHref(to)}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
