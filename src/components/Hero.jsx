import { Blob, Leaf } from './bits.jsx';

export default function Hero({ onShop, onLight }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Houseplants, shipped from Portland, Oregon</p>
          <h1 id="hero-title">Plants that suit the light you actually have</h1>
          <p className="lead">
            North-facing flat? Bright south window? Every plant here is sorted by the light it
            tolerates, how big it gets and whether it is safe around cats and dogs, so you can
            skip the guesswork.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#shop" onClick={(e) => { e.preventDefault(); onShop(); }}>
              Shop all plants
            </a>
            <a className="btn btn-ghost" href="#light" onClick={(e) => { e.preventDefault(); onLight(); }}>
              Find your light
            </a>
          </div>
          <ul className="hero-facts">
            <li>Free standard shipping from $75</li>
            <li>30-day plant guarantee</li>
            <li>Potted in recycled-clay pots</li>
          </ul>
        </div>
        <div className="hero-art">
          <Blob className="hero-blob" />
          <div className="hero-photo">
            <img
              src="https://images.unsplash.com/photo-1525498128493-380d1990a112?auto=format&fit=crop&w=1000&q=80"
              alt="Close-up of large split monstera leaves in daylight"
              width="1000"
              height="1250"
              fetchpriority="high"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <Leaf className="hero-leaf" />
        </div>
      </div>
    </section>
  );
}
