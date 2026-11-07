import { useCallback, useEffect, useState } from 'react';

const usd = (c) => `$${((c || 0) / 100).toFixed(2)}`;
const moneyRe = /^\d{1,6}(\.\d{1,2})?$/;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const BLANK = {
  id: '', name: '', latin: '', description: '', care: 'Easy', care_notes: '', price: '', compare: '',
  size: 'M', light: 'medium', pet_safe: false, stock: '0', image_url: '', image_alt: '', active: true, sort: '100',
};

const toForm = (p) => ({
  id: p.id, name: p.name, latin: p.latin, description: p.description, care: p.care, care_notes: p.care_notes,
  price: (p.price_cents / 100).toFixed(2), compare: p.compare_at_cents ? (p.compare_at_cents / 100).toFixed(2) : '',
  size: p.size, light: p.light, pet_safe: p.pet_safe, stock: String(p.stock), image_url: p.image_url,
  image_alt: p.image_alt, active: p.active, sort: String(p.sort),
});

function validate(f, isNew) {
  const e = {};
  if (!f.name.trim()) e.name = 'Enter a name.';
  if (isNew && !/^[a-z0-9][a-z0-9-]{0,59}$/.test(f.id)) e.id = 'Use lowercase letters, numbers and dashes only.';
  if (!moneyRe.test(f.price) || Number(f.price) <= 0) e.price = 'Enter a price above zero, like 34 or 34.50.';
  if (f.compare && (!moneyRe.test(f.compare) || Number(f.compare) <= Number(f.price))) e.compare = 'Leave blank, or enter a price higher than the sale price.';
  if (!/^\d{1,5}$/.test(f.stock)) e.stock = 'Enter a whole number, 0 or more.';
  if (f.image_url && !/^https:\/\/\S+$/.test(f.image_url)) e.image_url = 'Use a full https:// link.';
  if (!/^\d{1,6}$/.test(f.sort)) e.sort = 'Enter a whole number.';
  return e;
}

function Editor({ sb, product, onClose, onSaved }) {
  const isNew = !product;
  const [f, setF] = useState(product ? toForm(product) : BLANK);
  const [idTouched, setIdTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === 'name' && isNew && !idTouched ? { id: slug(v) } : {}) }));

  const field = (k, label, props = {}, Tag = 'input', children = null) => (
    <div className={`field ${errors[k] ? 'has-error' : ''}`}>
      <label htmlFor={`p-${k}`}>{label}</label>
      <Tag
        id={`p-${k}`}
        value={f[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={errors[k] ? 'true' : 'false'}
        aria-describedby={errors[k] ? `p-${k}-err` : undefined}
        {...props}
      >
        {children}
      </Tag>
      {errors[k] && <p className="err" id={`p-${k}-err`}>{errors[k]}</p>}
    </div>
  );

  const save = async (e) => {
    e.preventDefault();
    const errs = validate(f, isNew);
    setErrors(errs);
    setMsg('');
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`p-${first}`)?.focus();
      return;
    }
    const row = {
      name: f.name.trim(), latin: f.latin.trim(), description: f.description.trim(), care: f.care, care_notes: f.care_notes.trim(),
      price_cents: Math.round(Number(f.price) * 100), compare_at_cents: f.compare ? Math.round(Number(f.compare) * 100) : null,
      size: f.size, light: f.light, pet_safe: f.pet_safe, stock: Number(f.stock), image_url: f.image_url.trim(),
      image_alt: f.image_alt.trim(), active: f.active, sort: Number(f.sort),
    };
    setBusy(true);
    const { data, error } = isNew
      ? await sb.from('products').insert({ id: f.id, ...row }).select().single()
      : await sb.from('products').update(row).eq('id', f.id).select().single();
    setBusy(false);
    if (error || !data) {
      setMsg(
        error?.code === '23505' ? 'A plant with that ID already exists. Change the ID.'
        : error?.code === '42501' ? 'Your account is not allowed to change products.'
        : 'The product could not be saved. Check the fields and try again.'
      );
      return;
    }
    onSaved(data, isNew);
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await sb.from('products').delete().eq('id', f.id);
    setBusy(false);
    if (error) {
      setConfirmDelete(false);
      setMsg(
        error.code === '23503'
          ? 'This plant is part of past orders, so it cannot be deleted. Untick "Show in shop" and save to hide it instead.'
          : 'The product could not be deleted.'
      );
      return;
    }
    onSaved(null, false, f.id);
  };

  return (
    <form className="admin-form" onSubmit={save} noValidate aria-labelledby="pe-title">
      <button type="button" className="link-btn back" onClick={onClose}>&larr; All products</button>
      <h2 id="pe-title">{isNew ? 'Add a plant' : `Edit ${product.name}`}</h2>
      {msg && <p className="err-summary" role="alert">{msg}</p>}
      <div className="two">
        {field('name', 'Name', { maxLength: 120, required: true })}
        {isNew
          ? field('id', 'Product ID (used in links, cannot change later)', { maxLength: 60, onChange: (e) => { setIdTouched(true); set('id', slug(e.target.value)); } })
          : <div className="field"><span className="label-like">Product ID</span><p className="static">{f.id}</p></div>}
      </div>
      {field('latin', 'Latin name', { maxLength: 120 })}
      {field('description', 'Description', { rows: 3, maxLength: 800 }, 'textarea')}
      <div className="two">
        {field('price', 'Price (USD)', { inputMode: 'decimal', placeholder: '34.00' })}
        {field('compare', 'Compare-at price (optional, shows as a sale)', { inputMode: 'decimal', placeholder: '42.00' })}
      </div>
      <div className="two">
        {field('stock', 'Stock', { inputMode: 'numeric' })}
        {field('sort', 'Sort order (lower shows first)', { inputMode: 'numeric' })}
      </div>
      {field('image_url', 'Image link (https://...)', { inputMode: 'url', placeholder: 'https://' })}
      {field('image_alt', 'Image description for screen readers', { maxLength: 200 })}
      <div className="three">
        {field('light', 'Light', {}, 'select', ['low', 'medium', 'bright'].map((v) => <option key={v} value={v}>{v}</option>))}
        {field('size', 'Size', {}, 'select', [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']].map(([v, l]) => <option key={v} value={v}>{l}</option>))}
        {field('care', 'Care level', {}, 'select', ['Easy', 'Moderate', 'Fussy'].map((v) => <option key={v}>{v}</option>))}
      </div>
      {field('care_notes', 'Care notes', { rows: 3, maxLength: 800 }, 'textarea')}
      <div className="admin-checks">
        <label className="check"><input type="checkbox" checked={f.pet_safe} onChange={(e) => set('pet_safe', e.target.checked)} /> Safe for cats and dogs</label>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Show in shop</label>
      </div>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : isNew ? 'Add plant' : 'Save changes'}</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        {!isNew && !confirmDelete && (
          <button type="button" className="link-btn danger" onClick={() => setConfirmDelete(true)}>Delete plant</button>
        )}
        {!isNew && confirmDelete && (
          <span className="confirm-inline" role="group" aria-label="Confirm delete">
            Delete {product.name} for good?{' '}
            <button type="button" className="link-btn danger" onClick={remove} disabled={busy}>Yes, delete</button>{' '}
            <button type="button" className="link-btn" onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        )}
      </div>
    </form>
  );
}

export default function ProductsTab({ sb }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null = list, 'new', or a product
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await sb.from('products').select('*').order('sort').order('name');
    if (err) setError('Products could not be loaded.');
    else setList(data);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  if (editing) {
    return (
      <Editor
        sb={sb}
        product={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(row, isNew, removedId) => {
          setList((l) =>
            removedId ? l.filter((p) => p.id !== removedId)
            : isNew ? [...l, row].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
            : l.map((p) => (p.id === row.id ? row : p))
          );
          setNotice(removedId ? 'Plant deleted.' : isNew ? `${row.name} added.` : `${row.name} saved.`);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => { setNotice(''); setEditing('new'); }}>Add a plant</button>
        <button type="button" className="btn btn-outline" onClick={load}>Refresh</button>
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="err-summary" role="alert">{error}</p>}
      {list === null && !error && <p role="status">Loading products...</p>}
      {list && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Plant</th><th scope="col" className="num">Price</th>
                <th scope="col" className="num">Stock</th><th scope="col">Shown</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'dim'}>
                  <th scope="row">
                    <button type="button" className="link-btn" onClick={() => { setNotice(''); setEditing(p); }}>
                      {p.name}<span className="sr-only"> edit</span>
                    </button>
                  </th>
                  <td className="num">
                    {usd(p.price_cents)}
                    {p.compare_at_cents ? <small className="muted"> <s>{usd(p.compare_at_cents)}</s></small> : null}
                  </td>
                  <td className="num">{p.stock === 0 ? <span className="pill pill-cancelled">Sold out</span> : p.stock}</td>
                  <td>{p.active ? 'Yes' : <span className="muted">Hidden</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
