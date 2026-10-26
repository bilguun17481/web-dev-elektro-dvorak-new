# 03 Database schema and RLS (proposed)

Conventions: `id uuid pk default gen_random_uuid()`, `created_at/updated_at timestamptz`, money `integer` haléře (`*_minor`), quantities `numeric(12,3)`, every tenant table has `shop_id`. RLS is **enabled and forced on every table in `public`**; no policy means no access. Application writes go through the service-role client in `src/server/db/admin.ts` only (narrow wrappers, never imported by client code), or through `security definer` RPCs with fixed `search_path`.

## Tables

### Tenancy, staff, customers
| Table | Key columns |
|---|---|
| `shops` | slug, name, domain, locale, currency, vat_display (`gross`/`net`), settings jsonb (non-secret) |
| `branches` | shop_id, erp_code, name, address, `can_ship_directly`, `pickup_enabled`, sort_id (tiebreak) |
| `staff_members` | user_id → auth.users, shop_id, role enum, branch_id null; unique(user_id, shop_id) |
| `customers` | shop_id, user_id null, email, name, phone, `price_level_id`, company (ic, dic, vies_valid_at), marketing_consent |
| `addresses` | customer_id null, order_id null, kind, fields |
| `price_levels` | shop_id, erp_code, name, is_default, is_b2b |

### Catalogue and field ownership
| Table | Owner of columns | Key columns |
|---|---|---|
| `products` | **ERP** | shop_id, `erp_code` (unique per shop), erp_name, unit, vat_rate_id, `erp_active`, `last_seen_run_id`, ean null |
| `product_prices` | **ERP** | product_id, price_level_id, `price_minor`, `price_includes_vat`, `purchase_price_minor` (admin/owner only) |
| `branch_stock` | **ERP** | product_id, branch_id, qty, `updated_at`; unique(product_id, branch_id) |
| `product_content` | **Admin** | product_id, slug, name, short_description (check length <= 255), long_html, seo_title, seo_description, `published`, `content_source` (`scrape`/`admin`), brand_id |
| `product_images` | Admin | product_id, r2_key, sort, alt |
| `categories` | Admin | shop_id, parent_id, slug, name, sort; `product_categories` join |
| `parameter_defs` / `product_parameters` | Admin | structured filterable params: key, label, type, unit; value_text/num |
| `product_compliance` | Admin | energy_label, eprel_id, recycling_fee_minor, gpsr json (manufacturer, warnings) |
| `price_history` | system | product_id, price_level_id, price_minor, valid_from; feeds the 30 day lowest price |
| `redirects` | Admin | shop_id, from_path unique, to_path, status 301 |
| `field_ownership` | registry | entity, column, owner (`erp`/`admin`); read by the merge function and a test that fails if a column exists without an entry |

Ownership is enforced three ways: separate tables (ERP merge cannot reach `product_content`), the registry plus test, and column-level `GRANT`s so the admin role cannot update ERP columns.

### Orders, payments, shipping
| Table | Key columns |
|---|---|
| `orders` | shop_id, number (sequence per shop), customer_id null, email, status enum, totals (`subtotal_minor, vat_minor, shipping_minor, discount_minor, total_minor`), currency, price_level_id, `public_token_hash`, `legal_version_ids uuid[]`, delivery_method_id, pickup_branch_id, allocated_branch_id, allocation_overridden_by |
| `order_items` | order_id, product_id, **snapshot** code/name/unit_price_minor/vat_rate/qty/line totals |
| `order_events` | order_id, at, actor (user/system/provider), type, payload jsonb. **Append only** (no UPDATE/DELETE grants, trigger blocks) |
| `stock_reservations` | order_id, product_id, branch_id, qty, `expires_at`, `released_at`, status |
| `payments` | order_id, provider, method, amount_minor, status, provider_ref, variable_symbol |
| `payment_events` | provider, `event_id` (unique with provider), received_at, payload; the idempotency store |
| `bank_transactions` | external_id unique, booked_at, amount_minor, vs, counterparty_masked, matched_payment_id null, match_status |
| `shop_bank_accounts` | shop_id, iban, label. **Not readable by salesperson/readonly** |
| `shipping_methods` | shop_id, carrier, code, kind, enabled, pricing jsonb (FOFR coefficients, fuel surcharge, COD fee, thresholds) |
| `shipments` | order_id, carrier, tracking_no, status, `label_path` (private bucket), cost_minor |
| `discounts` | shop_id, `code_normalized` (unique, upper/trimmed), kind, value, min_total, valid range, usage limits, channel (`web`/`instore`) |
| `discount_redemptions` | discount_id, order_id |
| `erp_outbox` | order_id, payload, status (`pending/delivered/acked/failed`), attempts, acked_at |

### Sync
| Table | Key columns |
|---|---|
| `sync_runs` | shop_id, kind (`full`/`delta`), source, file_hash (unique per kind), status, started/finished, counts: seen, inserted, updated, unchanged, rejected, deactivated |
| `sync_batches` | run_id, seq, rows, status; unique(run_id, seq) |
| `sync_rejections` | run_id, row_no, code, reason, raw text |
| `sync_staging` | run_id, seq, payload jsonb (deleted after merge) |

### Legal
| Table | Key columns |
|---|---|
| `legal_documents` | shop_id, kind (`vop`, `reklamacni_rad`, `gdpr`, ...), slug |
| `legal_document_versions` | document_id, version int, body_html, `published_at`, immutable once published (trigger); unique(document_id, version) |
| `consents` | subject (customer/anon id), purpose, granted, at, version; Consent Mode record |

## RLS policy sketch

Helpers (`security definer`, `stable`, `search_path = ''`):
`app.staff_role(shop uuid) → role`, `app.is_staff(shop)`, `app.has_role(shop, roles[])`, `app.staff_branch(shop)`. They read `staff_members` only; **never JWT `user_metadata`**.

| Table(s) | anon | authenticated customer | staff |
|---|---|---|---|
| `shops, branches, categories, product_content (published), product_images, product_parameters, price_levels (default only), legal_document_versions (published)` | SELECT public rows | same | + write per role |
| `products, product_prices (default level), branch_stock` | via **views** `v_public_product`, `v_public_availability` that expose only price and a stock bucket, never raw qty of all branches or purchase price | + own price level via view | read by role |
| `customers, addresses` | none | own row (`user_id = auth.uid()`) | eshop_manager+ |
| `orders, order_items, payments, shipments` | none (guest order page goes through server with token hash) | own rows | salesperson: own branch only; manager/admin: all in shop; readonly: read |
| `order_events` | none | own, filtered kinds | by role; insert only via RPC |
| `purchase_price_minor` | none | none | owner, admin only (separate table `product_costs`, to make this a table grant not a column trick) |
| `shop_bank_accounts, bank_transactions, payment_events, erp_outbox, sync_*` | none | none | owner/admin/eshop_manager; salesperson **none** |
| `discounts` | none (validated by RPC `apply_discount(code)`; exact match on normalised code, bound parameter) | none | manager+ |
| revenue/reporting | none | none | views `v_revenue_*` with `security_invoker`, granted to owner/admin and users with explicit `can_view_revenue` |
| `staff_members` | none | none | owner/admin read; **writes only via service-role invite route** |

Policy template:
```sql
alter table orders enable row level security;
alter table orders force row level security;

create policy orders_customer_read on orders for select to authenticated
  using (customer_id in (select id from customers where user_id = (select auth.uid())));

create policy orders_staff_read on orders for select to authenticated
  using (app.has_role(shop_id, array['owner','admin','eshop_manager','readonly'])
      or (app.has_role(shop_id, array['salesperson']) and allocated_branch_id = app.staff_branch(shop_id)));
```

Important SQL functions (all `security definer`, tested):
`reserve_stock(order_id, lines)`, `release_expired_reservations()`, `merge_sync_run(run_id)`, `apply_payment_event(...)`, `confirm_payment_in_store(order_id)`, `apply_discount(shop, code, cart_total)`, `search_products(...)`.

## Required tests (pgTAP + Vitest)
1. As `anon`, `select` on every non-public table returns 0 rows or permission error; the list of tables is generated from `information_schema`, so a new table without RLS fails the build.
2. `authenticated` customer A cannot read customer B's orders.
3. `salesperson` of branch X cannot read branch Y orders, `shop_bank_accounts`, `product_costs`, revenue views.
4. No role can insert into `staff_members` except through the service role.
5. Discount code `%` / `_` / `' OR 1=1` never matches.
6. Duplicate `payment_events` insert is rejected; double webhook leaves order state unchanged.
7. `merge_sync_run` never changes any column owned by admin (driven by `field_ownership`).
