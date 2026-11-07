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

export function Footer() {
  return (
    <footer id="footer" className="footer">
      <div className="wrap footer-grid">
        <div>
          <p className="footer-brand"><Leaf className="wordmark-leaf" /> Fernhouse Plant Co.</p>
          <p className="footer-note">A fictional plant shop. Demo only: no orders are fulfilled and no payments are taken.</p>
        </div>
      </div>
      <div className="wrap legal">&copy; 2026 Fernhouse Plant Co. (fictional). Photos from Unsplash.</div>
    </footer>
  );
}
