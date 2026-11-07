# Setting up the real Fernhouse store

This guide turns the demo into a store that takes real payments. You do not need to write code. Everything below uses free plans, and Stripe only charges a small fee when you actually sell something.

You will use three services:

- **Supabase** keeps your products, stock and orders, and handles the admin login.
- **Stripe** takes the payments on its own secure page.
- **Vercel** hosts the website.

Set aside about 45 minutes. Keep a text file open to paste keys into. **Never share the secret keys with anyone and never put them in the code.**

The public demo on GitHub Pages keeps working on its own and needs none of this.

---

## A. Supabase (database and admin login)

1. Go to <https://supabase.com>, sign up and click **New project**. Pick any name (for example `fernhouse`), set a database password and choose a region near you. Wait until it finishes setting up.
2. In the left menu open **SQL Editor** and click **New query**.
3. Open the file `supabase/schema.sql` from this repository, copy everything, paste it into the editor and click **Run**. You should see "Success". This creates the tables, the security rules and your starting 16 plants.
4. **Required, do this before you create any login:** go to **Authentication**, then **Sign In / Providers**, turn **Off** "Allow new users to sign up", and keep **Confirm email** switched **On**. If sign-ups stay open, strangers can create accounts on your project. The shop only trusts accounts with a confirmed email, but do not leave the door open.
5. Add yourself as the admin. In a new query run this, with your own email in lowercase:

   ```sql
   insert into admins (email) values ('you@example.com') on conflict do nothing;
   ```

6. Create your login. Go to **Authentication**, then **Users**, then **Add user**, then **Create new user**. Enter the same email and a strong password, and tick **Auto Confirm User**.
7. Collect three values from **Project Settings**, then **API** (on newer dashboards, **API Keys**):
   - **Project URL**
   - **anon / public key**
   - **service_role key** (the secret one)

## B. Stripe (payments)

1. Go to <https://stripe.com>, sign up and confirm your email. You can stay in **test mode** (the toggle at the top of the dashboard) without any business verification. Nothing real is charged in test mode.
2. Open **Developers**, then **API keys**. Copy the **Secret key** (it starts with `sk_test_`).
3. Optional but recommended: in **Settings**, then **Customer emails**, switch on **Successful payments** so Stripe emails receipts.

## C. Vercel (the website)

1. Go to <https://vercel.com> and sign up with your GitHub account.
2. Click **Add New**, then **Project**, and import the `fernhouse-plant-shop` repository.
3. Leave the build settings as they are (Vercel detects Vite). Before you click Deploy, open **Environment Variables** and add these (the exact names matter). See `env.example.txt` for what each one does.

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `SUPABASE_URL` | your Supabase Project URL again |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |
   | `STRIPE_SECRET_KEY` | your Stripe `sk_test_...` key |
   | `SITE_URL` | the address Vercel gives you, for example `https://fernhouse-plant-shop.vercel.app` (you can edit this after the first deploy) |

   You will add `STRIPE_WEBHOOK_SECRET` in step D.
4. Click **Deploy**. When it finishes, open the address. You should see the shop with your plants, and **no** "Demo store" banners.
5. `SITE_URL` is **required**: checkout refuses to run without it. It must match the real address, with `https://` and no slash at the end, and it is the only address allowed to start a checkout. If you add your own domain later, update `SITE_URL` and redeploy.
6. Recommended: in Vercel open your project, then **Firewall**, and add a **rate limiting** rule for the path `/api/checkout` (for example 10 requests per minute per IP). The built-in limit in the code is only a light safeguard, because serverless copies do not share memory.
7. Visit `/admin` on your site and sign in with the login from step A6. You should see the Orders and Products tabs.

## D. Tell Stripe where to send payment news (webhook)

Without this step orders stay "pending" forever, because the shop only learns about payments through the webhook.

1. In Stripe go to **Developers**, then **Webhooks**, then **Add endpoint**.
2. **Endpoint URL:** `https://YOUR-DOMAIN/api/stripe-webhook`
3. **Events to listen to:** choose exactly these four:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
4. Click **Add endpoint**, then open it and reveal the **Signing secret** (it starts with `whsec_`).
5. In Vercel open **Settings**, then **Environment Variables**, and add `STRIPE_WEBHOOK_SECRET` with that value.
6. Go to **Deployments**, open the latest one, choose **Redeploy**. Variables only take effect after a new deploy.

## E. Test it

1. Open your shop, add a plant and go to checkout. Pick a delivery method and click **Continue to payment**.
2. On the Stripe page use the test card **4242 4242 4242 4242**, any future expiry date, any 3-digit CVC and any ZIP code. Use any US address.
3. You should land on a thank-you page with an order number like `FH-1001`.
4. In `/admin`, **Orders** should show the order as **paid**, and the plant's stock on **Products** should have gone down by the quantity you bought.
5. Try changing the status to **shipped**, and try **Export CSV**.
6. In Stripe, the **Webhooks** page should show the events as delivered with a 200 response. If you see failures, check the signing secret and redeploy.

Other test cards are listed at <https://docs.stripe.com/testing>. The card `4000 0000 0000 0002` is always declined.

## F. Going live

1. In Stripe, complete **Activate your account** (business details and bank account). This takes a day or two to approve.
2. When approved, switch the Stripe dashboard from test mode to **live mode**. Then:
   - Copy the live **Secret key** (`sk_live_...`) from **Developers**, **API keys**.
   - Create a **new webhook endpoint in live mode** (same URL and the same 4 events) and copy its new signing secret. Test-mode and live-mode webhooks are separate.
3. In Vercel replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with the live values, then **Redeploy**.
4. In Stripe, **Settings**, **Customer emails**: make sure **Successful payments** (receipts) is on in live mode too.
5. Place one real small order yourself and refund it from the Stripe dashboard to confirm everything works end to end.
6. Read the pages at `/shipping-returns`, `/privacy` and `/terms`. They are sample text for a fictional business, so edit them in `src/components/Pages.jsx` to match your real policies, address and contact email (ideally with advice from a lawyer).

## Everyday use

- **Orders:** `/admin`, Orders tab. Move orders along (paid, shipped, delivered). Refunds are made in the Stripe dashboard. Changing the status in the admin does not move money.
- **Products:** `/admin`, Products tab. Change prices, stock, photos and descriptions, or add new plants. A plant that has been ordered cannot be deleted. Untick **Show in shop** to hide it.
- **Stock:** plants are set aside (taken out of stock) the moment a customer starts paying, so two people cannot buy the last one. If the payment page is abandoned, expires (about an hour) or fails, they go back in stock automatically. Paid orders keep them.
- **Cancelling an unpaid order:** open it in Orders (choose "All orders" in the filter to see unpaid ones) and click Cancel. This closes the customer's payment page and puts the plants back.
- **Payment conflict:** if an order shows a red "Payment conflict" warning, money arrived for an order that had already been cancelled, or for a different amount. Open the payment in Stripe and either refund it or contact the customer. Their details are saved on the order.
- **More admins:** run the `insert into admins` query again with their email, and create their user in Supabase.

## If something goes wrong

- **The shop shows "Demo store" banners:** the two `VITE_` variables are missing or were added after the last deploy. Add them and redeploy.
- **Checkout says something went wrong:** check `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel, and look at **Logs** in the Vercel project.
- **Orders stay pending after paying:** the webhook is not set up or the signing secret is wrong (step D).
- **You are signed in at `/admin` but see "No access":** the email is not in the `admins` table, or the user was not confirmed.

## For developers

```powershell
npm install
npm test            # price rules, cart validation, webhook signature, CSV export
npm run build       # demo build (base /fernhouse-plant-shop/)
```

Production mode is switched on only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set at build time. Vercel builds with base `/` (it sets `VERCEL=1`); everything else builds the demo.
