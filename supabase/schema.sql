-- ============================================================================
-- Fernhouse Plant Co.: database schema (Supabase / Postgres)
--
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is idempotent, so running it again is safe (seed products are only inserted if missing,
-- so your later edits are never overwritten).
--
-- ADD THE FIRST ADMIN (run after this file, with your own email in lowercase):
--
--     insert into admins (email) values ('you@example.com') on conflict do nothing;
--
-- Then create the same user in Authentication -> Users -> Add user (email + password, tick
-- "Auto Confirm User"). More admins: add another row and create their user the same way.
-- Also in Supabase: Authentication -> Sign In / Providers -> turn OFF "Allow new users to sign up".
--
-- Security model: Row Level Security is ON for every table.
--   * Visitors (anon): can read ACTIVE products only. Nothing else.
--   * Admins (confirmed user whose email is in `admins`): full control of products, can read orders
--     and change an order's status.
--   * Orders are created and marked paid only by the server (service-role key), never by the browser.
-- ============================================================================

-- ---------- tables ----------
create table if not exists public.products (
  id               text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  name             text not null check (length(name) between 1 and 120),
  latin            text not null default '',
  description      text not null default '',
  care             text not null default 'Easy' check (care in ('Easy', 'Moderate', 'Fussy')),
  care_notes       text not null default '',
  price_cents      int  not null check (price_cents > 0),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents > price_cents),
  size             text not null default 'M' check (size in ('S', 'M', 'L')),
  light            text not null default 'medium' check (light in ('low', 'medium', 'bright')),
  pet_safe         boolean not null default false,
  rating           numeric(2,1) not null default 0 check (rating between 0 and 5),
  reviews          int  not null default 0 check (reviews >= 0),
  stock            int  not null default 0 check (stock >= 0),
  image_url        text not null default '',
  image_alt        text not null default '',
  active           boolean not null default true,
  sort             int  not null default 100,
  updated_at       timestamptz not null default now()
);

create table if not exists public.orders (
  id                    bigint generated always as identity (start with 1001) primary key,
  stripe_session_id     text unique,
  stripe_payment_intent text,
  status                text not null default 'pending'
                        check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),
  email                 text,
  customer_name         text,
  phone                 text,
  shipping_address      jsonb,
  shipping_method       text not null default 'standard' check (shipping_method in ('standard', 'express', 'pickup')),
  subtotal_cents        int  not null check (subtotal_cents >= 0),
  shipping_cents        int  not null check (shipping_cents >= 0),
  total_cents           int  not null check (total_cents >= 0),
  currency              text not null default 'usd',
  stock_reserved        boolean not null default false,  -- plants were taken out of stock when the order was created
  stock_released        boolean not null default false,  -- ...and put back after an unpaid order was cancelled
  payment_conflict      boolean not null default false,  -- money arrived for an order that was not waiting for it, or the amount differed
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- for databases created by an earlier version of this file
alter table public.orders add column if not exists stock_reserved boolean not null default false;
alter table public.orders add column if not exists stock_released boolean not null default false;
alter table public.orders add column if not exists payment_conflict boolean not null default false;

create table if not exists public.order_items (
  id               bigint generated always as identity primary key,
  order_id         bigint not null references public.orders (id) on delete cascade,
  product_id       text   not null references public.products (id),
  name             text   not null,
  unit_price_cents int    not null check (unit_price_cents > 0),
  qty              int    not null check (qty between 1 and 20)
);

create table if not exists public.admins (
  email text primary key check (email = lower(email))
);

-- ---------- indexes ----------
create index if not exists products_active_sort_idx on public.products (active, sort);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- ---------- helper functions ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- True only for a signed-in user with a CONFIRMED email that is listed in `admins`.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

-- Creates a pending order and RESERVES the plants in one transaction: stock is taken out for every
-- item, and the whole call fails ("insufficient_stock") if any plant is short, inactive or missing.
-- Called by the checkout API (service role). Paid orders keep their reservation.
create or replace function public.create_pending_order(
  p_shipping_method text, p_subtotal int, p_shipping int, p_total int, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint; r record;
begin
  insert into public.orders (shipping_method, subtotal_cents, shipping_cents, total_cents, stock_reserved)
  values (p_shipping_method, p_subtotal, p_shipping, p_total, true)
  returning id into v_id;

  insert into public.order_items (order_id, product_id, name, unit_price_cents, qty)
  select v_id, i.product_id, i.name, i.unit_price_cents, i.qty
  from jsonb_to_recordset(p_items) as i(product_id text, name text, unit_price_cents int, qty int);

  for r in
    select product_id, sum(qty)::int as qty
    from public.order_items where order_id = v_id
    group by product_id order by product_id
  loop
    update public.products set stock = stock - r.qty
    where id = r.product_id and active and stock >= r.qty;
    if not found then
      raise exception 'insufficient_stock:%', r.product_id;  -- rolls back the order and earlier reservations
    end if;
  end loop;

  return v_id;
end $$;

-- Puts the reserved plants back, exactly once, and only for an order that is cancelled.
-- A paid, shipped or delivered order never releases. Returns true if it released now.
create or replace function public.release_stock(p_order_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_done boolean;
begin
  update public.orders set stock_released = true
  where id = p_order_id and status = 'cancelled' and stock_reserved and not stock_released
  returning true into v_done;
  if v_done is null then return false; end if;

  update public.products p set stock = p.stock + i.qty
  from (
    select product_id, sum(qty)::int as qty from public.order_items where order_id = p_order_id group by product_id
  ) i
  where p.id = i.product_id;
  return true;
end $$;

drop function if exists public.decrement_stock(bigint);  -- replaced by reserve-on-create

-- An unpaid order must be cancelled through the server (it also has to release stock and expire the
-- Stripe session), so a signed-in admin cannot move a pending order directly.
create or replace function public.guard_order_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'pending' and new.status is distinct from old.status and auth.uid() is not null then
    raise exception 'pending orders can only be changed by the server';
  end if;
  return new;
end $$;

drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before update on public.orders
  for each row execute function public.guard_order_status();

-- ---------- privileges ----------
revoke all on table public.products, public.orders, public.order_items, public.admins from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select (id, name, latin, description, care, care_notes, price_cents, compare_at_cents, size, light,
              pet_safe, rating, reviews, stock, image_url, image_alt, active, sort, updated_at)
  on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;      -- gated by RLS to admins
grant select on public.orders, public.order_items to authenticated;    -- gated by RLS to admins
grant update (status) on public.orders to authenticated;               -- admins may only change the status
-- admins: no grants for anon or authenticated (edit it in the dashboard SQL editor only)

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.create_pending_order(text, int, int, int, jsonb) from public, anon, authenticated;
revoke all on function public.release_stock(bigint) from public, anon, authenticated;
grant execute on function public.create_pending_order(text, int, int, int, jsonb) to service_role;
grant execute on function public.release_stock(bigint) to service_role;

-- ---------- row level security ----------
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.admins      enable row level security;   -- no policies = nobody but the service role

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon using (active);

drop policy if exists products_admin_read on public.products;
create policy products_admin_read on public.products for select to authenticated using (active or public.is_admin());
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());

drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read on public.orders for select to authenticated using (public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_admin_read on public.order_items;
create policy order_items_admin_read on public.order_items for select to authenticated using (public.is_admin());

-- ---------- seed: the starting catalog (prices in cents) ----------
insert into public.products
  (id, name, latin, description, care, care_notes, price_cents, compare_at_cents, size, light, pet_safe, rating, reviews, stock, image_url, image_alt, sort)
values
  ('monstera', 'Monstera Deliciosa', 'Monstera deliciosa', 'The classic split-leaf climber. Grows fast in bright, indirect light and forgives the odd missed watering.', 'Easy', 'Water when the top 5 cm of soil is dry. Wipe leaves monthly. Give it a moss pole once it passes 80 cm.', 6800, null, 'L', 'medium', false, 4.8, 112, 9, 'https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=800&q=80', 'Monstera in a pot on a wooden stool beside a white chair', 10),
  ('snake', 'Snake Plant Laurentii', 'Dracaena trifasciata', 'Upright, architectural and nearly unkillable. Happy in a dim hallway or a sunny sill.', 'Easy', 'Water every 3 to 4 weeks. Let the soil dry fully between drinks. Overwatering is the only real way to lose it.', 3400, null, 'M', 'low', false, 4.9, 204, 24, 'https://images.unsplash.com/photo-1687552212914-03a30c82053c?auto=format&fit=crop&w=800&q=80', 'Snake plant with upright striped leaves in a pot', 20),
  ('calathea', 'Calathea Orbifolia', 'Goeppertia orbifolia', 'Broad, silver-striped leaves that fold up at night. Safe for cats and dogs, but likes steady humidity.', 'Fussy', 'Use filtered or rain water. Keep soil evenly damp, never soggy. Avoid direct sun, which fades the stripes.', 5200, null, 'M', 'medium', true, 4.3, 58, 6, 'https://images.unsplash.com/photo-1714507767656-2fb307e1b03d?auto=format&fit=crop&w=800&q=80', 'Round patterned calathea leaves', 30),
  ('pothos', 'Golden Pothos', 'Epipremnum aureum', 'A trailing starter plant that tolerates low light and tells you clearly when it is thirsty by drooping.', 'Easy', 'Water when leaves just begin to soften. Trim vines to keep it full; cuttings root in a glass of water.', 2800, 3600, 'S', 'low', false, 4.7, 176, 31, 'https://images.unsplash.com/photo-1596724878582-76f1a8fdc24f?auto=format&fit=crop&w=800&q=80', 'Golden pothos with heart-shaped leaves in a pot', 40),
  ('zz', 'ZZ Plant', 'Zamioculcas zamiifolia', 'Waxy, dark leaves on sculptural stems. Stores water in its rhizomes, so it copes with travel and neglect.', 'Easy', 'Water every 3 weeks in summer, monthly in winter. Low light slows growth but does not harm it.', 4600, null, 'M', 'low', false, 4.8, 143, 14, 'https://images.unsplash.com/photo-1787676841452-9e7d64fe781b?auto=format&fit=crop&w=800&q=80', 'ZZ plant with glossy dark green leaflets', 50),
  ('fiddle', 'Fiddle Leaf Fig', 'Ficus lyrata', 'A statement tree with big violin-shaped leaves. Wants a bright spot and to be left where you put it.', 'Fussy', 'Rotate a quarter turn each week. Water thoroughly, then let the top third dry. Dislikes drafts and moving.', 12500, 14500, 'L', 'bright', false, 4.2, 87, 4, 'https://images.unsplash.com/photo-1453904300235-0f2f60b15b5d?auto=format&fit=crop&w=800&q=80', 'Fiddle leaf fig with large violin-shaped leaves', 60),
  ('peperomia', 'Peperomia Watermelon', 'Peperomia argyreia', 'Compact, pet-safe and patterned like its namesake. Good on a desk or bookshelf.', 'Easy', 'Water when the soil is dry two knuckles down. Thick leaves store water, so err on the dry side.', 2900, null, 'S', 'medium', true, 4.6, 64, 18, 'https://images.unsplash.com/photo-1685721269025-d70a32c5bcd9?auto=format&fit=crop&w=800&q=80', 'Peperomia with silver-striped round leaves', 70),
  ('cactus', 'Blue Columnar Cactus', 'Cereus repandus', 'An upright, slow-growing cactus for the sunniest sill you have. Spines are sharp; keep it out of paw reach.', 'Easy', 'Water deeply once a month in summer and almost not at all in winter. Needs several hours of direct sun.', 3800, null, 'S', 'bright', true, 4.5, 49, 12, 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=800&q=80', 'Blue columnar cactus in an orange terracotta pot', 80),
  ('rubber', 'Rubber Plant', 'Ficus elastica', 'Thick, dark leaves that gloss up with a wipe. A forgiving tree for a bright room without direct sun.', 'Moderate', 'Water when the top 4 cm is dry. Dust the leaves with a damp cloth. Prune the top to encourage branching.', 7200, null, 'L', 'medium', false, 4.7, 95, 7, 'https://images.unsplash.com/photo-1669392597221-bbfd4b6e13ff?auto=format&fit=crop&w=800&q=80', 'Rubber plant with thick glossy leaves in a pot', 90),
  ('fern', 'Boston Fern', 'Nephrolepis exaltata', 'Soft, arching fronds that suit a bathroom or a shaded shelf. Safe around pets.', 'Moderate', 'Keep soil lightly damp. Mist or group with other plants for humidity. Trim brown fronds at the base.', 3600, null, 'M', 'medium', true, 4.4, 71, 15, 'https://images.unsplash.com/photo-1599148401005-fe6d7497cb5e?auto=format&fit=crop&w=800&q=80', 'Boston fern fronds', 100),
  ('aloe', 'Aloe Vera', 'Aloe vera', 'Thick, fleshy leaves and a love of sun. Currently sold out; the next batch arrives in spring.', 'Easy', 'Water every 2 to 3 weeks. Use gritty cactus mix and a pot with drainage holes.', 2400, null, 'S', 'bright', false, 4.6, 130, 0, 'https://images.unsplash.com/photo-1570295835271-04c05b4ed943?auto=format&fit=crop&w=800&q=80', 'Aloe vera plant in a pot', 110),
  ('palm', 'Parlor Palm', 'Chamaedorea elegans', 'A gentle, feathery palm that copes with low light and is safe for cats and dogs.', 'Easy', 'Water when the top 3 cm is dry. Keep out of hot afternoon sun. Brown tips usually mean dry air.', 4200, null, 'M', 'low', true, 4.5, 82, 11, 'https://images.unsplash.com/photo-1687269111857-3b398711c2f4?auto=format&fit=crop&w=800&q=80', 'Parlor palm with feathery fronds in a pot', 120),
  ('philo', 'Philodendron Brasil', 'Philodendron hederaceum', 'Heart-shaped leaves with a lime streak down the centre. Trails from a shelf or climbs a small trellis.', 'Easy', 'Water when the top 3 cm is dry. Brighter light keeps the variegation strong.', 3100, 3900, 'S', 'medium', false, 4.6, 101, 20, 'https://images.unsplash.com/photo-1600411833196-7c1f6b1a8b90?auto=format&fit=crop&w=800&q=80', 'Heartleaf philodendron trailing from a pot', 130),
  ('bird', 'Bird of Paradise', 'Strelitzia nicolai', 'Paddle leaves on a tall, upright frame. Our largest plant and the best fit for a sunny corner.', 'Moderate', 'Water generously in summer, less in winter. Needs a south or west window. Leaves split naturally with age.', 14500, null, 'L', 'bright', false, 4.7, 39, 3, 'https://images.unsplash.com/photo-1555803741-1ac759ac2f53?auto=format&fit=crop&w=800&q=80', 'Bird of paradise plant with orange and blue flowers', 140),
  ('string', 'String of Pearls', 'Curio rowleyanus', 'Bead-like leaves spill over the edge of a hanging pot. Likes light and a very light hand with water.', 'Fussy', 'Water only when the pearls look slightly flat. Use a shallow pot and sharp-draining soil.', 3300, null, 'S', 'bright', false, 4.1, 44, 8, 'https://images.unsplash.com/photo-1765041425888-39e09e148a80?auto=format&fit=crop&w=800&q=80', 'Trailing succulent with round bead-like leaves in a pot', 150),
  ('jade', 'Jade Plant', 'Crassula ovata', 'A tiny tree with fat, glossy leaves that can live for decades. Slow growing and long lived.', 'Easy', 'Water when the soil is fully dry. Give it a bright window and it will thicken its stems over the years.', 4000, 4800, 'M', 'bright', false, 4.7, 77, 13, 'https://images.unsplash.com/photo-1616189597001-9046fce2594d?auto=format&fit=crop&w=800&q=80', 'Jade plant with thick oval leaves in a white pot', 160)

on conflict (id) do nothing;
