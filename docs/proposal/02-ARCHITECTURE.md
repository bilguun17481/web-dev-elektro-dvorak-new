# 02 ARCHITECTURE.md (proposed)

## Principles
1. Domain logic is pure TypeScript (`src/domain`): pricing, VAT, shipping cost, warehouse allocation, SPAYD. No I/O, no framework imports.
2. Every external system sits behind an adapter interface (`ErpSource`, `PaymentProvider`, `CarrierProvider`, `BankFeed`, `Mailer`). Nothing outside `src/adapters` knows which implementation is active.
3. The LAN never accepts inbound connections. A small **sync agent** on the company network makes outbound HTTPS calls only.
4. Postgres does set-based work (merge of 200k rows, stock reservation under lock). Workers do HTTP, validation and orchestration, because Worker CPU time is metered.
5. Money is integer haléře. The server computes every price; the client only displays.

## Data flow

```
 COMPANY LAN (no inbound)                    CLOUDFLARE                         SUPABASE
 ┌────────────────────┐   HTTPS (HMAC)  ┌───────────────────┐   RPC/SQL   ┌──────────────────────┐
 │ Signys (9 servers) │                 │ Worker: Next.js   │             │ Postgres + RLS       │
 │  └ CSV můstek      │                 │  /api/ingest/*    │────────────▶│ sync_runs/batches    │
 │ sync-agent (Node)  │────────────────▶│  zod, auth, batch │             │ merge_sync_run() SQL │
 │  · reads CSV       │  1 batch=~1000  │                   │             │ products, prices,    │
 │  · pushes batches  │  rows, seq no.  │ Site (SSR/ISR)    │◀────────────│ branch_stock         │
 │  · pulls outbox ◀──┼─────────────────│  catalogue, cart  │             │                      │
 │  · acks            │  GET /erp/outbox│  checkout steps   │────────────▶│ orders, payments,    │
 └────────────────────┘                 │                   │             │ erp_outbox, events   │
        ▲                               │ Admin (cs)        │             └──────────────────────┘
        │ staff imports reservation     │ Cron Triggers     │                       ▲
        │ file into Signys (phase 4)    │  · expire reserv. │   webhooks (signed)   │
        │                               │  · bank poll      │   Comgate/Stripe ─────┘
        │                               │  · feeds → R2     │   KB API ◀── cron pull
        │                               └─────────┬─────────┘
        │                                         │ R2: images (WebP), feeds, ISR cache
        │                                         │ Supabase Storage (private): labels, invoices
        └── Balíkobot ◀── label request ──────────┘   Resend: email
```

**Order path:** cart → `checkout` steps → `orders` (+`order_events`) → payment (hosted page / QR) → payment confirmed (webhook or bank match) → allocation to branch → `erp_outbox` row (reservation vs customer "ESHOP") → agent pulls it and writes a file/queue the branch staff process in Signys → staff mark packed in admin → Balíkobot label (private storage, signed URL) → shipment events → email.

## ERP adapter
```ts
interface ErpSource {
  readonly kind: "csv-bridge" | "signys-api";
  fetchSnapshot(opts): AsyncIterable<ErpRowBatch>;            // full
  fetchChanges(since: SyncCursor): AsyncIterable<ErpRowBatch>; // delta
  pushReservation(order: ErpReservation): Promise<ErpAck>;     // CSV: writes outbox file
}
```
- Normalised row = `{ code, name, unit, vatRate, prices: Record<priceLevel, minor>, stock: Record<branchCode, qty>, ean? }`. CSV column mapping lives in one file (`csv-bridge/mapping.ts`), versioned, because the feed format is still unknown.
- **Idempotency/resume:** each run has `file_hash`; each batch `(run_id, seq)` is unique, so re-sending a batch is a no-op. The agent asks `GET /api/ingest/runs/:id` for the last committed `seq` and continues.
- **Rejections** are stored per row with code and raw line; run is `partial` not failed. Admin sync dashboard shows both.
- **Full import safety:** items absent from a full snapshot are set `erp_active=false` only after the run finishes, and only if < 5 % of active items would flip (configurable), else the run halts for review. Prevents a truncated CSV from wiping the catalogue.
- Only ERP-owned columns are written by the merge (see SCHEMA field ownership). A test asserts the merge never touches admin-owned columns.
- Match by `code`, never EAN, until the feed carries EAN.

## Checkout as named steps (`src/server/checkout/`)
`validate → price → reserve → createOrder → startPayment → notify`, each a function `(ctx) => Result` with its own tests; `runCheckout` only sequences them. `price` calls the pure `computeTotals`; the client total is ignored. `reserve` calls one SQL function (`reserve_stock`) that locks `branch_stock` rows and inserts `stock_reservations` with `expires_at` (default 30 min, extended while a payment is pending). Cron releases expired holds. Failure after `reserve` releases it (compensation step, tested).

## Pure functions (most tests)
- `computeTotals({cart, customer, priceLevel, discounts, shipping, shop})` → lines, VAT per rate, shipping, discount, grand total, all minor units. Rounding rule: VAT computed per rate group on the summed base, once, in `domain/vat.ts`.
- `lowestPrice30d(history)` for strike-through prices.
- `shippingCost(method, parcel, cod, config)`: FOFR Module B `(17.52 + 9.542·max(kg,15.65))·(1+fuel)+26+0.015·cod`; fuel in config; Module F `max(kg, m³·122)`. Guards: above the configured COD ceiling (default 21,600 Kč ex VAT) or above FOFR insurance 25,000 Kč, COD is refused or the price switches to cost based.
- `allocateBranch(items, branches)`: filter `canShipDirectly` and covers all lines → min purchase price → max stock → min branch id. Returns `{branchId}|{needsManual, reason}`; deterministic, property-tested.
- `spayd({iban, amount, vs, msg})`.

## Payments
`PaymentProvider { id; createPayment(order, urls); parseWebhook(req): Promise<VerifiedEvent> ; fetchStatus(ref) }`.
Webhook route is generic: **verify signature → zod parse → insert `payment_events(provider, event_id)` (unique, duplicate = 200 no-op) → re-fetch state from provider → apply transition in one SQL function**. Providers that cannot sign (Comgate uses a secret in the POST plus server side status fetch) rely on the re-fetch step. Card data never touches us (hosted pages only, SAQ A). Bank transfer: SPAYD QR; `BankFeed` (KB API Plus, polled by cron every N min) writes `bank_transactions`, matcher uses variable symbol + amount; mismatches go to an admin queue. Staff confirm in store via RPC `confirm_payment_in_store(order_id)` returning only VS and amount, never the account.

## Catalogue, search, caching
- Content seed from `ed_export/products.csv` into admin-owned content tables (`content_source='scrape'`), images → sharp/WebP at 4 widths (e.g. 320/640/960/1600) → R2 `img/{hash}/{w}.webp`. Prices/stock from scrape are never imported.
- Search: `unaccent` + `pg_trgm` + FTS (`simple` config on unaccented text; no Czech stemmer in Supabase), generated `search_text`, one RPC `search_products(q, shop, filters)`. Measure at 20k cards; escalate to Typesense only if p95 > 150 ms or relevance fails on a fixed query set.
- Pages: ISR with tag revalidation (OpenNext incremental cache on R2). Price and availability are fetched per request from a small cached JSON endpoint so the HTML stays cacheable. Cache config and Workers CPU budget to be load tested in phase 5.
- 301 map: `redirects` table loaded from `url_map.csv`, served by middleware lookup from an edge-cached JSON; test asserts every old URL resolves in one hop.

## Auth and roles
Supabase Auth with public sign-up **disabled** for staff; staff created only by admin invite (service-role API route, audited). Roles live in `staff_members`, never in `user_metadata` (user-writable). Customers register through a separate flow and can never get a staff row. Roles: `owner`, `admin`, `eshop_manager`, `salesperson` (per branch), `readonly`.

## Multi-shop
`shops` row = brand, domain, currency, locale, enabled payment/shipping methods, legal doc set, Resend sender. Tenant tables carry `shop_id`; hostname → shop resolved in middleware. One deployment, many hostnames. Only `elektrodvorak` ships now.

## Environments
| Env | App | DB | Gateways |
|---|---|---|---|
| local | `next dev` + `wrangler` | Supabase CLI local stack | mocks / sandbox |
| staging | Workers `ed-staging`, own domain | separate Supabase project | sandbox keys, Balíkobot test keys |
| production | Workers `ed-prod` | Supabase Pro | live; switch is manual and explicit |

Migrations are numbered files in `supabase/migrations`, applied by CI to staging on merge to `main` and to production by a manually approved workflow job. Secrets in Cloudflare/GitHub secrets only. Sentry (or Cloudflare Workers Observability + Sentry) for errors; uptime check on `/api/health`; an alert job pings when a provider's last N calls fail or webhook volume drops to zero for a window.

## Repo layout
```
src/domain/        pure logic + tests
src/adapters/      erp/ payments/ carriers/ bank/ mail/
src/server/        checkout steps, services, db clients (anon / user / service)
src/app/           routes (shop, admin, api)
agent/             sync agent (separate package, runs on LAN)
supabase/          migrations/, seed/, tests/ (pgTAP RLS tests)
docs/              README, ARCHITECTURE, COMPLIANCE, ADRs
```
