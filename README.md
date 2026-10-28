# Elektro Dvořák · e-shop

Storefront and back office for **Elektro Dvořák** (elektrodvorak.cz), the electro,
appliance, computer, tool and garden-machinery retailer of Dvořák a synové, s.r.o., with
six stores in Golčův Jeníkov, Čáslav, Chotěboř, Světlá nad Sázavou, Třemošnice and
Heřmanův Městec.

It follows the structure of [web-dev-part-2](https://github.com/bilguun17481/WEB-DEV-part-2)
and the architecture agreed in `docs/proposal`. What is different from that sibling, and
why, is in [What changed](#what-changed-from-web-dev-part-2).

## Status

Working: the storefront (home, categories, product pages, cart), the admin with its
shipping settings, the carrier provider layer with a Balíkobot adapter, the pure domain
layer, and the 301 map from the old site. 146 tests. Not built yet: checkout, payments,
orders, the ERP sync agent, and the Supabase project itself. The proposal documents
describe all of them.

## Layout

| Path | What |
| --- | --- |
| `src/domain` | Pure business rules: money, VAT, pricing, shipping, branch allocation, SPAYD, ERP code matching. No I/O, no framework. ESLint enforces that. |
| `src/adapters/carriers` | Carrier integrations: Balíkobot, and a manual provider for portals with no API. Each describes its own credential fields, so the admin renders a form for it. |
| `src/app/admin` | The back office. Login and shipping settings today. |
| `src/server` | Server-only code: the redirect lookup today, checkout steps and database clients next. |
| `src/app` | Routes. |
| `src/data` | The seed catalogue and the generated data. |
| `data/export` | The scraped export of the old site: 11,196 product URLs and 389 categories. |
| `supabase` | Migrations and seeds. |
| `docs/proposal` | Research, architecture, schema, conventions, decisions and the export analysis. |

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 118 tests, about a second
npm run build && npm start
```

No environment variables are needed to run the storefront: it serves the seed catalogue.
`.env.example` lists every variable the app will read.

## The domain layer

Everything about money lives in `src/domain` and is tested there, because these are the
rules that are expensive to get wrong and cheap to test.

- **`money.ts`** Integer haléře behind a branded `Minor` type, so Kč cannot be passed
  where haléře are expected. `allocateProportionally` splits an amount across rows so the
  parts sum to exactly the total, which is what keeps a discount from losing a haléř per
  VAT group.
- **`vat.ts`** VAT once per rate group on the summed base. Two 10 Kč lines at 21 % give
  347, not the 348 that per-line rounding produces.
- **`pricing.ts`** `computeTotals` prices a cart. A discount reduces each VAT group in
  proportion to its share of the goods. `lowestPriceIn` backs the "lowest price in 30
  days" claim that has to sit next to a discount.
- **`shipping.ts`** The FOFR Module B tariff with its coefficients as configuration, and
  Module F volumetric weight for when dimensions exist. Returns a manual-quote result
  rather than pricing from a weight the feed does not have.
- **`allocation.ts`** Which branch ships an order, with every comparison ending on a
  stable tiebreak so an allocation can be reproduced when someone asks why.
- **`erpCode.ts`** How ERP codes are matched, derived from measuring the real export.
- **`spayd.ts`** The Czech QR payment string, with an IBAN check digit test.

## Carriers, and adding one without code

The split that makes this work: *what a provider can do* is code, *which providers are
connected and how they are priced* is data.

- **Balíkobot** fronts most Czech carriers (PPL, DPD, Zásilkovna, Česká pošta, GLS and
  others). Connect it once in the admin and every carrier on the account is available as
  a dropdown, not a deploy.
- **Manual** covers any portal with no API at all, FOFR among them. Give it a name and a
  tracking URL with a `{tracking}` placeholder; staff book the consignment in whatever
  portal it lives in, paste the number into the order, and the customer gets a link.

Both are configured under **Správa → Doprava**. A provider declares its credential fields
in its own `definition`, and the admin builds the form from that, so connecting a provider
the UI has never heard of needs no UI work. Tariffs are data too, including the FOFR
Module B coefficients: a fuel surcharge change is a field, not a release.

Credentials are encrypted with `SECRETS_KEY` before they are stored and are never sent
back to the browser. A secret field can be replaced; it cannot be read.

Only a genuinely new kind of API needs a new file in `src/adapters/carriers` plus one line
in its registry. Everything else is the admin.

### What is verified about the Balíkobot integration

Verified from the reference PHP client, which tracks the official v2 documentation: HTTP
Basic authentication with an API user and key, and the method names `add`, `track`,
`labels`, `info/whoami` and `info/carriers`. **Not verified**: the base URL, the version
segment, and the field names of the `add` payload, because balikobot.cz is blocked by the
development environment's network policy. The base URL and version are therefore admin
fields with a default rather than constants, `testConnection` uses only the verified parts,
and `createShipment` carries a comment saying to check it against your account's own
documentation before the first live consignment.

## The 301 map

`npm run data:build` turns the export into `src/data/generated/redirects.json` and
`supabase/seed/0002_redirects.sql`: 11,196 product URLs and 389 category URLs, keyed on
the old path, which the export proves unique.

Two things the map does that are worth knowing:

**It serves only what resolves.** The catalogue holds 72 seeded products, so 457 of the
11,585 redirects are live and the rest pass through. A 301 onto a 404 is worse for
customers and for search than leaving the old URL alone, and the gate opens by itself as
products arrive. `src/server/redirects.test.ts` asserts every served target resolves and
that no hop chains into another.

**It matches on the old id, not the old slug.** The old site renamed slugs after the
scrape, and the harvested catalogue shortened others, so the id is the only stable key.

## What changed from web-dev-part-2

| | web-dev-part-2 | here |
| --- | --- | --- |
| Money | `price: number` in Kč, converted at the gateway boundary; percent discounts via `Math.round(subtotal * value) / 100` | integer haléře behind a branded type, converted only for display |
| VAT | none | computed once per rate group, with the breakdown on the cart |
| Pricing | inline in `checkout.ts` next to the database calls | a pure `computeTotals` the server and the cart both call |
| Shipping | flat price with a free-over threshold | the FOFR tariff, with a manual-quote result where the data does not support a price |
| Branch allocation | none | implemented, deterministic, flags what it cannot decide |
| Redirects | none | 11,585, generated and tested |
| Carriers | six hand-written carrier files, credentials from environment variables, adding one meant editing code and redeploying | a provider registry with Balíkobot and a manual provider, connected and priced from the admin, credentials encrypted at rest |
| Admin auth | a login page with no guard behind it | session cookie signed with HMAC, every server action re-checks the session and the role |
| Tests | none | 146 |
| Stock display | a single number | per branch, and nothing shown until the feed is real |

## What is still missing

- **`product_urls.json`** is absent from the export, so there is no category tree: all 389
  categories are flat and 15 of them share a slug and carry their old id until their
  parents are known.
- **The Signys sample CSV.** The column interpretation in
  `docs/proposal/05-DECISIONS-AND-FEED.md` is unconfirmed without it.
- **The scrape is not a complete snapshot.** 4 of the 72 harvested products are not in the
  export at all, so it needs re-running before the redirects go live.
- **There is no Supabase project**, so the admin stores its settings in `.data/shop.json`
  and the owner login comes from the environment. Both are development arrangements:
  `supabase/migrations/0001_init.sql` holds the real schema with its RLS, and the store
  sits behind an interface so swapping it changes one file.
