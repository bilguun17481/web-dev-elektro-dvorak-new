-- Shops, staff, redirects and the carrier configuration the admin edits.
--
-- RLS is enabled and forced on every table here. No policy means no access, which is the
-- default this schema relies on: carrier_connections has no policy at all, so credentials
-- are reachable only by the service role, never by a signed-in user of any role.

create extension if not exists "pgcrypto";

create schema if not exists app;

-- ── Tenancy ──────────────────────────────────────────────────────────────────────────

create table shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  domain text unique,
  locale text not null default 'cs',
  currency text not null default 'CZK',
  vat_display text not null default 'gross' check (vat_display in ('gross', 'net')),
  created_at timestamptz not null default now()
);

create type staff_role as enum ('owner', 'admin', 'eshop_manager', 'salesperson', 'readonly');

create table staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references shops (id) on delete cascade,
  role staff_role not null,
  branch_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, shop_id)
);

-- Authorisation reads this table and nothing else. Never auth.jwt() -> user_metadata,
-- which the user can write to themselves.
create function app.staff_role(shop uuid)
returns staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_members
  where user_id = (select auth.uid()) and shop_id = shop
$$;

create function app.has_role(shop uuid, roles staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.staff_role(shop) = any(roles), false)
$$;

-- ── Redirects (the 301 map seeded from the old site) ─────────────────────────────────

create table redirects (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  from_path text not null,
  to_path text not null,
  status smallint not null default 301 check (status in (301, 302, 308)),
  created_at timestamptz not null default now(),
  unique (shop_id, from_path)
);

-- ── Carriers ─────────────────────────────────────────────────────────────────────────

-- One connection to a shipping provider. `credentials` holds encrypted envelopes for the
-- keys listed in `secret_keys`; the application encrypts before it writes, so a dump of
-- this table does not hand over the ability to create consignments.
create table carrier_connections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  provider_id text not null,
  label text not null,
  enabled boolean not null default true,
  credentials jsonb not null default '{}'::jsonb,
  secret_keys text[] not null default '{}',
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shipping_methods (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  connection_id uuid not null references carrier_connections (id) on delete cascade,
  carrier_code text not null,
  name text not null,
  description text not null default '',
  enabled boolean not null default true,
  sort integer not null default 0,
  vat_rate_bp integer not null default 2100 check (vat_rate_bp >= 0),
  needs_pickup_point boolean not null default false,
  allows_bulky boolean not null default false,
  -- Tariff, including the FOFR coefficients. Shape is validated by zod in the
  -- application; the check here only keeps the discriminator honest.
  pricing jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_has_known_kind
    check (pricing ->> 'kind' in ('store_pickup', 'flat', 'own_delivery', 'fofr_pallet')),
  unique (shop_id, connection_id, carrier_code, name)
);

create index shipping_methods_shop_enabled on shipping_methods (shop_id, enabled, sort);
create index redirects_shop_from on redirects (shop_id, from_path);

-- ── Row level security ───────────────────────────────────────────────────────────────

alter table shops enable row level security;
alter table shops force row level security;
alter table staff_members enable row level security;
alter table staff_members force row level security;
alter table redirects enable row level security;
alter table redirects force row level security;
alter table carrier_connections enable row level security;
alter table carrier_connections force row level security;
alter table shipping_methods enable row level security;
alter table shipping_methods force row level security;

-- The shop itself and its redirects are public: the storefront reads them unauthenticated.
create policy shops_public_read on shops for select to anon, authenticated using (true);
create policy redirects_public_read on redirects for select to anon, authenticated using (true);

-- Enabled shipping methods are public, because the cart has to show them. The connection
-- behind them is not, so no credential is reachable through this.
create policy shipping_methods_public_read on shipping_methods
  for select to anon, authenticated using (enabled);

create policy shipping_methods_manage on shipping_methods
  for all to authenticated
  using (app.has_role(shop_id, array['owner', 'admin', 'eshop_manager']::staff_role[]))
  with check (app.has_role(shop_id, array['owner', 'admin', 'eshop_manager']::staff_role[]));

-- Staff may see their own membership, so the admin can tell them their role.
create policy staff_members_self_read on staff_members
  for select to authenticated using (user_id = (select auth.uid()));

-- carrier_connections deliberately has NO policy. With RLS forced and no policy, every
-- role is denied, and only the service role reaches it. Credentials are never read by a
-- browser session however privileged the person is.
