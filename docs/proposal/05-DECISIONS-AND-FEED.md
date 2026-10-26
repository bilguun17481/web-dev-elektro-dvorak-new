# 05 Decisions so far and Signys feed analysis (2026-10-26)

## Decisions from Bíbo
| # | Decision | Consequence |
|---|---|---|
| 1 | Invoices issued by **Signys** | We never generate VAT invoices. Order export carries everything Signys needs; our order confirmation is not a tax document. |
| 2 | Accounts owned by Bíbo for now, transfer to company later | Keep infra reproducible (docs + config in repo), no personal email as sole owner where avoidable. Supabase supports project transfer between orgs. |
| 3 | Gateway wording "go pay at launch" (**to confirm: GoPay?**); Comgate not signed yet, can be; Balíkobot not signed yet; FOFR booked separately | Payment adapter makes the first gateway swappable. FOFR is not behind Balíkobot, so Phase 4 treats it as a separate carrier (manual shipment + tracking entry unless FOFR has an API). |
| 4 | Order split across branches wanted; flag to manual allocation when the rule cannot decide | Schema adds `order_allocations` (order_item, branch, qty); shipments hang off allocations. |
| 5 | KB bank API cost acceptable; Supabase size fine | |
| 6 | Withdrawal button: wait for 1. 1. 2027 | Build behind a dated feature flag; row in COMPLIANCE.md. |
| 7 | Full cutover probable, **not committed** | Keep soft launch possible (shop-level flag per product subset). |
| 9 | Purchase price: Tresoft can add it. Dimensions: no. B2B: not needed now | Allocation rule stays as specified. FOFR uses weight only (Module B); no volume formula, so bulky items without a sensible weight are flagged for a manual quote. Launch has one price per card. `price_levels` stays in the schema with a single default row, so B2B can be added later without a migration of order data. |
| 8 | No AZ database export | Customer and order history from the old site is lost. Redirects only. |

## Signys CSV export (programmer's email)
- Runs **hourly from 07:00 for 12 hours** (my reading of "od 7.00 v celou, po dobu 12 hodin"), full file ~40 MB, copied to FTP around half past. So: **full snapshot hourly, no delta, no night updates**. Stock is up to ~1 h stale and 19:00 to 07:00 is frozen. Our "delta" is computed on our side by row hash.
- Location: `C:\sgshare\export` on the central server. Second export would cost 3 to 4 h of Tresoft work; a second FTP target for the existing file may be enough, and a LAN agent reading the share needs neither.

Columns and what they mean for us (interpretation, **to confirm with a sample file**):

| Column | Probable use | Open point |
|---|---|---|
| ID_ARTIKL, ID_SKLKARTA | card ids | which is the key we match on; relation to old site `code` |
| KTGINTERNI, KTGREF | category refs | map to our tree |
| NAZEV, POPIS1, POPIS2 | name, descriptions | ERP name is fallback only; content is admin-owned |
| **CAROVYKOD** | **barcode / EAN** | earlier assumption (no EAN) is wrong if populated; verify |
| DRUHALT | ? | |
| PC, PC_AKCNI | price, promo price | gross or net? which price level? single price only? |
| SAZBADPH | VAT rate | |
| MJ, HMOTNOST, ZARUKA | unit, weight, warranty | weight feeds shipping cost |
| STAVCELKEM, STAVREZERVACE | stock total, reserved | per branch row or global total? |
| POBOCKA | branch | implies one row per card per branch |
| HLAVNI_KARTA | master card flag | basis for deduplicating cards |
| HLEDANI | search keywords | feeds search |
| NOVINKA, AKCE, VYPRODEJ | flags | badges, feeds |
| DATUM | timestamp | |
| POZNAMKA_INTERNI | internal note | **never publish** |

**Missing for the specified features:** `nákupní cena` (needed for the allocation rule "lowest purchase price"), multiple price levels (B2B, later), dimensions or volume (FOFR Module F), "can ship directly" per branch (we hold that ourselves in `branches`).

## Scraper output (uploaded files)
- `url_map.csv`: **11,196 product URLs**, all shaped `/slug/pro<id>.html`, columns `old_url, old_path, id, code`.
- `product_urls.json`: 11,197 products each with category id lists (4 levels, e.g. `[8, 46, 166, 18]`; 8 is "Super ceny", a virtual category). One more entry than the map; to reconcile.
- `categories.json`: **389 categories** with id, url (`/slug/kat<id>.html`), name; all 389 marked done. Category URLs need 301s too, not just products.
- `code` quality: 6,525 purely numeric; **59 are `KAT<id>` placeholders** (56 equal `KAT`+old id, so no real Signys code to match); **2 empty** (ids 525945, 523428, Kingston cards); **105 codes shared by 226 URLs** (duplicate cards, the known kartotéka problem). Redirects stay keyed by old URL; many old URLs may collapse to one new URL. The 61 unmatched need manual mapping or name matching.
