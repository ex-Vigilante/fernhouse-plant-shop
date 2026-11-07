import { useEffect, useRef, useState } from 'react';
import { FREE_SHIPPING_AT, useCart } from '../cart.jsx';
import { money } from '../data/products.js';
import { Img } from './bits.jsx';

export const SHIPPING = [
  { id: 'standard', label: 'Standard', detail: '4 to 6 business days', price: 8.5 },
  { id: 'express', label: 'Express', detail: '2 business days, in a heat-safe box', price: 16 },
  { id: 'pickup', label: 'Portland pickup', detail: 'Ready the next day at our greenhouse', price: 0 },
];

export const shippingCost = (id, subtotal) => {
  const m = SHIPPING.find((s) => s.id === id);
  if (id === 'standard' && subtotal >= FREE_SHIPPING_AT) return 0;
  return m.price;
};

const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const zipRe = /^\d{5}$/;

const validators = {
  name: (v) => (v.trim().length < 2 ? 'Enter your full name.' : ''),
  email: (v) => (!v.trim() ? 'Enter your email address.' : emailRe.test(v.trim()) ? '' : 'Enter a valid email, like name@example.com.'),
  address: (v, all) => (all.shipping === 'pickup' || v.trim().length >= 4 ? '' : 'Enter your street address.'),
  city: (v, all) => (all.shipping === 'pickup' || v.trim() ? '' : 'Enter your city.'),
  state: (v, all) => (all.shipping === 'pickup' || STATES.includes(v) ? '' : 'Choose your state.'),
  zip: (v, all) => (all.shipping === 'pickup' ? '' : zipRe.test(v.trim()) ? '' : 'Enter a 5-digit ZIP code, like 97205.'),
};

const omitDigits = ({ digits, ...rest }) => rest;
const initial = { name: '', email: '', address: '', city: '', state: '', zip: '', shipping: 'standard' };

export default function Checkout({ onBack, onPlaced }) {
  const { items, subtotal, clear } = useCart();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [summaryCount, setSummaryCount] = useState(0);
  const titleRef = useRef(null);
  useEffect(() => titleRef.current?.focus(), []);

  const shipCost = shippingCost(values.shipping, subtotal);
  const total = subtotal + shipCost;

  const check = (name) => validators[name](values[name], values);
  const errors = Object.fromEntries(Object.keys(validators).map((k) => [k, touched[k] ? check(k) : '']));
  const setField = (name, value) => setValues((v) => ({ ...v, [name]: value }));
  const blur = (name) => setTouched((t) => ({ ...t, [name]: true }));

  const submit = (e) => {
    e.preventDefault();
    const all = Object.fromEntries(Object.keys(validators).map((k) => [k, check(k)]));
    setTouched(Object.fromEntries(Object.keys(validators).map((k) => [k, true])));
    const bad = Object.keys(all).filter((k) => all[k]);
    setSummaryCount(bad.length);
    if (bad.length) {
      document.getElementById(`c-${bad[0]}`)?.focus();
      return;
    }
    if (!items.length) return;
    const order = {
      number: `FH-${Math.floor(10000 + Math.random() * 90000)}`,
      items: items.map((l) => ({ id: l.id, name: l.product.name, qty: l.qty, price: l.product.price })),
      subtotal,
      shipCost,
      total,
      shipping: SHIPPING.find((s) => s.id === values.shipping),
      email: values.email.trim(),
      name: values.name.trim(),
      address:
        values.shipping === 'pickup'
          ? 'Pickup at Fernhouse greenhouse, Portland, OR'
          : `${values.address.trim()}, ${values.city.trim()}, ${values.state.trim().toUpperCase()} ${values.zip.trim()}`,
    };
    clear();
    onPlaced(order);
  };

  const field = (name, label, props = {}, Tag = 'input', children = null) => (
    <div className={`field ${errors[name] ? 'has-error' : ''} ${props.className || ''}`}>
      <label htmlFor={`c-${name}`}>{label}</label>
      <Tag
        id={`c-${name}`}
        name={name}
        value={values[name]}
        onChange={(e) => setField(name, props.digits ? e.target.value.replace(/\D/g, '') : e.target.value)}
        onBlur={() => blur(name)}
        aria-invalid={errors[name] ? 'true' : 'false'}
        aria-describedby={errors[name] ? `c-${name}-err` : undefined}
        {...omitDigits(props)}
      >
        {children}
      </Tag>
      {errors[name] && <p className="err" id={`c-${name}-err`}>{errors[name]}</p>}
    </div>
  );

  if (!items.length) {
    return (
      <section className="section wrap checkout-empty">
        <h1>Your cart is empty</h1>
        <p>Add a plant or two and come back to check out.</p>
        <button type="button" className="btn btn-primary" onClick={onBack}>Back to the shop</button>
      </section>
    );
  }

  const pickup = values.shipping === 'pickup';
  const errorCount = summaryCount;

  return (
    <section className="section checkout" aria-labelledby="co-title">
      <div className="wrap">
        <button type="button" className="link-btn back" onClick={onBack}>&larr; Back to the shop</button>
        <h1 id="co-title" ref={titleRef} tabIndex={-1}>Checkout</h1>
        <div className="demo-banner" role="note">
          <strong>Demo store, no real payment is taken.</strong> Nothing you enter here is sent anywhere, and no plants will ship.
        </div>

        <div className="co-grid">
          <form onSubmit={submit} noValidate aria-describedby={errorCount ? 'co-errors' : undefined}>
            {errorCount > 0 && (
              <p id="co-errors" className="err-summary" role="alert">
                {errorCount === 1 ? 'There is 1 problem to fix below.' : `There are ${errorCount} problems to fix below.`}
              </p>
            )}
            <fieldset>
              <legend>Contact</legend>
              {field('name', 'Full name', { autoComplete: 'name' })}
              {field('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email' })}
            </fieldset>

            <fieldset>
              <legend>Delivery method</legend>
              <div className="ship-options">
                {SHIPPING.map((s) => {
                  const cost = shippingCost(s.id, subtotal);
                  return (
                    <label key={s.id} className={`ship-opt ${values.shipping === s.id ? 'on' : ''}`}>
                      <input type="radio" name="shipping" value={s.id} checked={values.shipping === s.id} onChange={() => setField('shipping', s.id)} />
                      <span>
                        <strong>{s.label}</strong>
                        <small>{s.detail}</small>
                      </span>
                      <span className="ship-price">{cost === 0 ? 'Free' : money(cost)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend>Shipping address</legend>
              {pickup ? (
                <p className="muted">No address needed. We will email you when your plants are ready to collect.</p>
              ) : null}
              {!pickup && (
                <>
                  {field('address', 'Street address', { autoComplete: 'street-address' })}
                  <div className="three">
                    {field('city', 'City', { autoComplete: 'address-level2' })}
                    {field('state', 'State', { autoComplete: 'address-level1' }, 'select', [
                      <option key="" value="">Select</option>,
                      ...STATES.map((s) => <option key={s} value={s}>{s}</option>),
                    ])}
                    {field('zip', 'ZIP code', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 5, digits: true, placeholder: '97205' })}
                  </div>
                </>
              )}
            </fieldset>

            <button type="submit" className="btn btn-primary btn-lg">Place demo order &middot; {money(total)}</button>
          </form>

          <aside className="summary" aria-label="Order summary">
            <h2>Order summary</h2>
            <ul className="sum-lines">
              {items.map(({ product: p, qty }) => (
                <li key={p.id}>
                  <div className="line-img"><Img src={p.image} alt="" width={160} height={200} /></div>
                  <span>{p.name}<small>Qty {qty}</small></span>
                  <span>{money(p.price * qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="totals">
              <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
              <div><dt>Shipping</dt><dd>{shipCost === 0 ? 'Free' : money(shipCost)}</dd></div>
              <div className="grand"><dt>Total</dt><dd>{money(total)}</dd></div>
            </dl>
            <p className="muted small">Prices in USD, sales tax included.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
