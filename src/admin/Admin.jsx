import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase.js';
import { useDocumentMeta } from '../meta.js';
import { Link } from '../router.jsx';
import { Leaf } from '../components/bits.jsx';
import OrdersTab from './OrdersTab.jsx';
import ProductsTab from './ProductsTab.jsx';

function Login({ sb }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError('That email or password is not right.');
    setBusy(false);
  };

  return (
    <section className="section admin-login" aria-labelledby="adm-login-title">
      <div className="wrap admin-narrow">
        <h1 id="adm-login-title">Store admin</h1>
        <p className="muted">Sign in with the account the shop owner set up.</p>
        <form onSubmit={submit} noValidate>
          {error && <p className="err-summary" role="alert">{error}</p>}
          <div className="field">
            <label htmlFor="adm-email">Email</label>
            <input id="adm-email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="adm-pass">Password</label>
            <input id="adm-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !email || !password}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
];

function Dashboard({ sb }) {
  const [tab, setTab] = useState('orders');
  const refs = useRef({});

  const onKey = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = TABS.length - 1;
    if (n === null) return;
    e.preventDefault();
    setTab(TABS[n].id);
    refs.current[TABS[n].id]?.focus();
  };

  return (
    <section className="section admin" aria-label="Store admin">
      <div className="wrap">
        <div role="tablist" aria-label="Admin sections" className="admin-tabs" onKeyDown={onKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              ref={(el) => { refs.current[t.id] = el; }}
              className={tab === t.id ? 'on' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'orders' ? <OrdersTab sb={sb} /> : <ProductsTab sb={sb} />}
        </div>
      </div>
    </section>
  );
}

export default function Admin() {
  useDocumentMeta({ title: 'Store admin - Fernhouse Plant Co.', description: 'Fernhouse store admin.', noindex: true });
  const [sb, setSb] = useState(null);
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [admin, setAdmin] = useState(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let sub;
    let live = true;
    getSupabase()
      .then(async (client) => {
        if (!live) return;
        setSb(client);
        const { data } = await client.auth.getSession();
        if (live) setSession(data.session);
        sub = client.auth.onAuthStateChange((_event, s) => setSession(s)).data.subscription;
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      sub?.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!sb || session === undefined) return undefined;
    if (!userId) {
      setAdmin(undefined);
      return undefined;
    }
    let live = true;
    sb.rpc('is_admin').then(({ data, error }) => live && setAdmin(!error && data === true));
    return () => {
      live = false;
    };
  }, [sb, session === undefined, userId]);

  const signOut = () => sb.auth.signOut();

  return (
    <>
      <header className="site-header">
        <div className="wrap header-row">
          <Link className="wordmark" to="/" aria-label="Fernhouse Plant Co. home">
            <Leaf className="wordmark-leaf" />
            <span>Fernhouse</span>
          </Link>
          <p className="admin-label">Store admin</p>
          {session ? (
            <button type="button" className="btn btn-outline" onClick={signOut}>Sign out</button>
          ) : (
            <Link to="/" className="link-btn">View shop</Link>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {failed ? (
          <section className="section wrap admin-narrow"><p role="alert">The admin could not load. Please refresh.</p></section>
        ) : !sb || session === undefined || (session && admin === undefined) ? (
          <section className="section wrap admin-narrow"><p role="status">Loading...</p></section>
        ) : !session ? (
          <Login sb={sb} />
        ) : !admin ? (
          <section className="section wrap admin-narrow">
            <h1>No access</h1>
            <p>You are signed in as <strong>{session.user.email}</strong>, but this account is not a store admin.</p>
            <button type="button" className="btn btn-primary" onClick={signOut}>Sign out</button>
          </section>
        ) : (
          <Dashboard sb={sb} />
        )}
      </main>
    </>
  );
}
