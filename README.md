# Fernhouse Plant Co.: React e-commerce storefront

An online shop for a Portland houseplant store. Shoppers filter plants by the light they actually have, add them to a cart that remembers them, and pay through Stripe Checkout. The owner manages orders and products from a private admin page.

It runs in two modes from the same code:

- **Real store (Vercel):** products, prices and stock come from Supabase, payment happens on Stripe's hosted page, orders are saved, stock goes down automatically, and the owner uses `/admin`. Setup steps for a non-technical owner are in [SETUP.md](SETUP.md).
- **Public demo (GitHub Pages):** with no environment variables the site is the original front-end demo. The catalog is built in, checkout is a validated form that takes no payment, and nothing is stored.

**Live demo:** https://ex-vigilante.github.io/fernhouse-plant-shop/

![Fernhouse homepage](screenshots/desktop.jpg)

| Catalog with live filters | Cart drawer | Phone |
|---|---|---|
| ![Product grid with filters](screenshots/catalog.jpg) | ![Cart drawer with free-shipping bar](screenshots/cart.jpg) | ![Homepage on a phone](screenshots/mobile.jpg) |

## Features

- **Live filtering:** search by common or Latin name, plus filters for light level, size and pet-safe. Results update instantly, and filters are saved in the URL so a filtered view can be shared.
- **Quick view:** an accessible product dialog with care notes and a quantity picker limited to stock.
- **Cart drawer:** change quantities, remove items, see the subtotal and a free-shipping progress bar. Saved in localStorage, so the cart survives a reload.
- **Stock-aware buttons:** a product can't be added beyond stock ("Max in cart"), and sold-out items are disabled.
- **Checkout:** three delivery options that update the total (standard, express, Portland pickup; free standard shipping from $75). In the real store the button hands over to Stripe Checkout, and the server re-prices the cart from the database so a browser can never set its own prices. The demo keeps the short validated form and a confirmation page with no payment.
- **Orders and stock:** a signed Stripe webhook marks orders paid and takes the plants out of stock exactly once. The thank-you page shows the real order number.
- **Admin (`/admin`):** email and password login. Orders tab: newest first, filter by status, order detail, change status, link to the payment in Stripe, CSV export. Products tab: edit price, compare-at, stock, active, image and description, add plants. Access is enforced by database rules, not just the screen.
- **Store pages and SEO:** shipping and returns, privacy and terms pages, per-page titles and Open Graph tags, product structured data (JSON-LD), favicon and robots.txt.
- **Light guide:** the "Find your light" cards jump straight to filtered results.
- **Accessibility:** focus-trapped dialogs (Esc closes them and focus returns where it was), screen-reader announcements for the cart and results, skip link, WCAG AA contrast, full keyboard use.
- **Polish:** micro-animations that switch off for users who prefer reduced motion, fixed image ratios so the page doesn't jump while loading, and a one-column layout on small phones.

## Tech stack

- React 18 + Vite 6
- Plain CSS (custom properties, grid)
- Google Fonts: Bricolage Grotesque + DM Sans
- Stripe Checkout, Supabase (Postgres, Auth, Row Level Security), Vercel serverless functions in `api/`
- GitHub Actions deploys the demo to GitHub Pages

## Run locally

Needs [Node.js](https://nodejs.org) 20 or newer. In PowerShell:

```powershell
npm install
npm run dev
```

Open the address Vite prints (it ends in `/fernhouse-plant-shop/`). To test the production build:

```powershell
npm run build
npm run preview
```

Run the tests (price and shipping rules, cart validation, webhook signature checks, CSV export):

```powershell
npm test
```

## Project layout

- `src/` is the React storefront and admin. `src/mode.js` decides demo or real store.
- `api/` holds the serverless functions: `checkout.js`, `stripe-webhook.js`, `order.js`.
- `shared/pricing.js` is the one copy of the price and shipping rules, used by the browser and the server.
- `supabase/schema.sql` creates the tables, security rules and the seed catalog.
- `env.example.txt` documents every environment variable. `SETUP.md` is the owner's guide.

## Deploy

- **Demo:** every push to `main` runs `.github/workflows/deploy.yml`, which builds the site with no environment variables and publishes it to GitHub Pages. In the repo, set **Settings → Pages → Source** to **GitHub Actions**. If you rename the repo, update the fallback `base` in `vite.config.js`.
- **Real store:** import the repo into Vercel, add the environment variables from `env.example.txt` and deploy. Vercel builds with base `/`. Full steps in [SETUP.md](SETUP.md).

## Notes

Card details are only ever entered on Stripe's own page and never reach this code. Secret keys live only in server environment variables. The sample policy pages describe a fictional business, so replace them with your own before taking real orders. Photos are from [Unsplash](https://unsplash.com).
