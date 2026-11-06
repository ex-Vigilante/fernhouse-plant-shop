import { useState } from 'react';
import { Blob, Leaf } from './bits.jsx';

const LIGHTS = [
  {
    key: 'low',
    title: 'Low light',
    where: 'North windows, hallways, rooms where you read the page fine but the sun never lands.',
    test: 'Your shadow is faint or blurry at midday.',
    picks: 'Snake plant, ZZ plant, pothos, parlor palm',
  },
  {
    key: 'medium',
    title: 'Medium light',
    where: 'East windows, or a couple of metres back from a south window.',
    test: 'Your shadow has soft edges, and sun reaches the sill for a short spell.',
    picks: 'Monstera, calathea, peperomia, rubber plant',
  },
  {
    key: 'bright',
    title: 'Bright light',
    where: 'South and west windows, where direct sun hits the leaves for several hours.',
    test: 'Your shadow is crisp and dark from late morning on.',
    picks: 'Fiddle leaf fig, bird of paradise, cacti, jade',
  },
];

export function LightGuide({ onPick }) {
  return (
    <section id="light" className="section guide" aria-labelledby="guide-title">
      <Blob className="guide-blob" />
      <div className="wrap">
        <div className="section-head">
          <h2 id="guide-title">Find your plant by light</h2>
          <p>Light is the thing that decides whether a plant thrives. Stand in the spot you have in mind at noon, then match it below.</p>
        </div>
        <ul className="guide-grid">
          {LIGHTS.map((l, i) => (
            <li key={l.key} className={`guide-card g${i}`}>
              <Leaf className="guide-leaf" />
              <h3>{l.title}</h3>
              <p>{l.where}</p>
              <p className="test"><strong>Quick test:</strong> {l.test}</p>
              <p className="muted">Try: {l.picks}</p>
              <button type="button" className="btn btn-outline" onClick={() => onPick(l.key)}>
                Show {l.title.toLowerCase()} plants
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const REVIEWS = [
  { name: 'Maya R.', place: 'Seattle, WA', plant: 'Snake Plant Laurentii', text: 'Arrived upright with the soil still in the pot, which has not been true of other shops. It lives in a hallway with one small window and has not complained.' },
  { name: 'Dev P.', place: 'Austin, TX', plant: 'Calathea Orbifolia', text: 'I was nervous about a fussy plant, but the care card was specific about water type and humidity. Two months in and the stripes are still sharp.' },
  { name: 'Jo & Sam', place: 'Minneapolis, MN', plant: 'Parlor Palm', text: 'We have two cats and wanted something safe on a low shelf. The pet-safe filter saved us an evening of googling.' },
];

export function Testimonials() {
  return (
    <section id="reviews" className="section reviews" aria-labelledby="rev-title">
      <div className="wrap">
        <div className="section-head">
          <h2 id="rev-title">What customers might say</h2>
          <p className="sample-label">Sample reviews. Written for this demo store; they are not from real customers.</p>
        </div>
        <ul className="rev-grid">
          {REVIEWS.map((r) => (
            <li key={r.name} className="rev">
              <p className="rev-text">&ldquo;{r.text}&rdquo;</p>
              <p className="rev-by"><strong>{r.name}</strong>, {r.place}<span>Bought: {r.plant}</span></p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Footer() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', msg: '' });

  const submit = (e) => {
    e.preventDefault();
    const v = email.trim();
    if (!v) return setState({ status: 'error', msg: 'Enter your email address.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setState({ status: 'error', msg: 'Enter a valid email, like name@example.com.' });
    setState({ status: 'ok', msg: `Thanks, ${v} looks good. This is a demo store, so the address was not saved.` });
    setEmail('');
  };

  return (
    <footer id="footer" className="footer">
      <div className="wrap footer-grid">
        <div>
          <p className="footer-brand"><Leaf className="wordmark-leaf" /> Fernhouse Plant Co.</p>
          <p className="footer-note">A fictional plant shop built as a portfolio project. No orders are fulfilled and no payments are taken.</p>
        </div>
        <form onSubmit={submit} noValidate className="news" aria-labelledby="news-title">
          <h2 id="news-title">Seasonal care notes</h2>
          <p>One short email a month: what to repot, what to water less.</p>
          <div className="news-row">
            <div className={`field ${state.status === 'error' ? 'has-error' : ''}`}>
              <label htmlFor="news-email">Email address</label>
              <input
                id="news-email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => { setEmail(e.target.value); if (state.status !== 'idle') setState({ status: 'idle', msg: '' }); }}
                aria-invalid={state.status === 'error'}
                aria-describedby="news-msg"
              />
            </div>
            <button type="submit" className="btn btn-primary">Subscribe</button>
          </div>
          <p id="news-msg" className={state.status === 'error' ? 'err' : 'ok'} role="status" aria-live="polite">{state.msg}</p>
        </form>
      </div>
      <div className="wrap legal">&copy; 2026 Fernhouse Plant Co. (fictional). Photos from Unsplash.</div>
    </footer>
  );
}
