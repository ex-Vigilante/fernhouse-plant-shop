import { useEffect, useRef } from 'react';
import { SHIPPING_METHODS, FREE_SHIPPING_CENTS } from '../../shared/pricing.js';
import { PROD } from '../mode.js';
import { Link } from '../router.jsx';

const cash = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
const EMAIL = 'hello@fernhouse.example';
const UPDATED = 'November 2026';

function Doc({ title, children }) {
  const head = useRef(null);
  useEffect(() => head.current?.focus(), []);
  return (
    <section className="section doc" aria-labelledby="doc-title">
      <div className="wrap doc-wrap">
        <Link to="/" className="link-btn back">&larr; Back to the shop</Link>
        <h1 id="doc-title" ref={head} tabIndex={-1}>{title}</h1>
        <p className="muted small">Last updated {UPDATED}</p>
        {!PROD && (
          <div className="demo-banner" role="note">
            <strong>Demo store.</strong> This page is sample text for a fictional shop.
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function ShippingReturns() {
  return (
    <Doc title="Shipping and returns">
      <h2>Where and when we ship</h2>
      <p>
        We ship from our greenhouse in Portland, Oregon to addresses in the United States. Orders are packed within 1 to 2
        business days. Plants are never shipped on a Friday or before a holiday, so they do not sit in a warehouse over the weekend.
      </p>
      <h2>Delivery options and prices</h2>
      <ul className="doc-list">
        <li><strong>{SHIPPING_METHODS.standard.label}:</strong> {SHIPPING_METHODS.standard.detail}, {cash(SHIPPING_METHODS.standard.cents)}. Free when your plants come to {cash(FREE_SHIPPING_CENTS)} or more.</li>
        <li><strong>{SHIPPING_METHODS.express.label}:</strong> {SHIPPING_METHODS.express.detail}, {cash(SHIPPING_METHODS.express.cents)}.</li>
        <li><strong>{SHIPPING_METHODS.pickup.label}:</strong> {SHIPPING_METHODS.pickup.detail}, free. We email you when your order is ready to collect and ask you to bring your order number.</li>
      </ul>
      <p>You get a tracking link by email as soon as your order ships.</p>
      <h2>Cold and hot weather</h2>
      <p>
        In winter we add a heat pack and in summer we choose faster service when the forecast is extreme. If the weather along
        the route looks unsafe for plants, we may hold your order for a few days and let you know by email.
      </p>
      <h2>30-day plant guarantee</h2>
      <p>
        If a plant arrives damaged or dies within 30 days despite following the care notes, email us at{' '}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a> with your order number and a clear photo. We will send a replacement or refund
        you, whichever you prefer. Please report damage from shipping within 3 days of delivery.
      </p>
      <h2>Returns and refunds</h2>
      <p>
        Unused pots, planters and care supplies can be returned within 14 days of delivery. Live plants cannot be returned
        because they do not travel well twice, but the guarantee above still applies. Refunds go back to the original payment method and
        usually appear within 5 to 10 business days. Return shipping is paid by the customer unless the item was damaged or wrong.
      </p>
      <h2>Cancelling an order</h2>
      <p>Email us as soon as you can. If your order has not shipped we will cancel it and refund you in full.</p>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc title="Privacy policy">
      <p>
        Fernhouse Plant Co. ("we", "us"), of Portland, Oregon, runs this online shop. This page explains what we collect and why.
        Questions can go to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
      <h2>What we collect</h2>
      <ul className="doc-list">
        <li><strong>Order details:</strong> your name, email address, phone number, delivery address and what you bought. You enter these on the secure Stripe payment page.</li>
        <li><strong>Payment details:</strong> card numbers are entered only on Stripe's page. They never reach our website or database, and we cannot see them.</li>
        <li><strong>Your cart:</strong> saved in your own browser (local storage) so it is still there when you come back. It is not sent to us until you check out.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To take payment, pack and deliver your order, send order emails, handle returns and answer your questions. We also keep
        order records as long as the law requires for tax and accounting. We do not sell your data and we do not run advertising or
        tracking cookies.
      </p>
      <h2>Who else sees it</h2>
      <ul className="doc-list">
        <li><strong>Stripe</strong> processes payments and may send you a receipt.</li>
        <li><strong>Supabase</strong> stores our product and order records.</li>
        <li><strong>Vercel</strong> hosts the website, and shipping carriers receive your name, address and phone number to deliver your parcel.</li>
      </ul>
      <h2>Your choices</h2>
      <p>
        You can ask to see, correct or delete the personal data we hold about you, subject to records we must keep by law. Email us
        and we will reply within 30 days. You can clear your saved cart at any time by clearing this site's data in your browser.
      </p>
      <h2>Changes</h2>
      <p>If we change this policy we will update the date at the top of the page.</p>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc title="Terms of sale">
      <p>These terms apply to purchases from Fernhouse Plant Co., Portland, Oregon ("we", "us"). By placing an order you agree to them.</p>
      <h2>Orders and prices</h2>
      <p>
        All prices are in US dollars. The price you pay is the price shown at checkout, plus any shipping shown there. An order is
        accepted when we send you an order confirmation. We may cancel and refund an order if an item turns out to be unavailable or a
        price was shown by mistake.
      </p>
      <h2>Live plants</h2>
      <p>
        Plants are living things. Size, leaf pattern and colour vary a little from the photos. Our care notes are guidance, not a
        guarantee, and results depend on your light, watering and home. Some plants are toxic to pets if chewed; each plant page says
        whether it is pet-safe, and you are responsible for keeping plants away from animals and children.
      </p>
      <h2>Payment</h2>
      <p>Payments are handled by Stripe. We do not store your card details.</p>
      <h2>Delivery, returns and guarantee</h2>
      <p>
        See our <Link to="/shipping-returns">shipping and returns</Link> page. Delivery dates are estimates. Risk passes to you when the
        parcel is delivered, and our 30-day plant guarantee still applies after that.
      </p>
      <h2>Liability</h2>
      <p>
        To the extent the law allows, our liability for any order is limited to the amount you paid for it. Nothing in these terms limits
        rights you have under consumer law that cannot be waived.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of Oregon.</p>
      <h2>Contact</h2>
      <p>Fernhouse Plant Co., Portland, OR. <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
    </Doc>
  );
}

export function NotFound() {
  const head = useRef(null);
  useEffect(() => head.current?.focus(), []);
  return (
    <section className="section wrap checkout-empty" aria-labelledby="nf-title">
      <h1 id="nf-title" ref={head} tabIndex={-1}>Page not found</h1>
      <p>That page does not exist. Maybe it wandered off to a sunnier window.</p>
      <Link to="/" className="btn btn-primary">Back to the shop</Link>
    </section>
  );
}
