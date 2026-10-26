# 06 Scraper export verified against the actual files (2026-10-26)

The scraper output is now in the repo (`url_map.csv`, `categories.json`), so the figures in
`05-DECISIONS-AND-FEED.md` are no longer second-hand. Several were wrong; the corrections are
below and 05 has been patched to point here. Worklists for the manual mapping are committed
next to this file:

- `06-unmatched-codes.csv` — 64 rows with no usable Signys code
- `06-duplicate-codes.csv` — the 104 code groups covering 224 old URLs

## What arrived, what is still missing
| File | State |
|---|---|
| `url_map.csv` | present, 1.68 MB, 11,196 data rows |
| `categories.json` | present, 49 KB, 389 entries |
| `product_urls.json` | **missing** — still needed |
| Signys sample CSV | **missing** — still needed, 05's column table stays unconfirmed |

`product_urls.json` held the category assignment per product and the 4-level category paths.
Without it there is no parent/child information anywhere in the export: `categories.json` is a
flat list with no parent field, so **the category tree cannot be reconstructed from what we
have**. The 11,197-vs-11,196 off-by-one also stays open; note that `url_map.csv` is 11,197
*lines* including the header, so the discrepancy may simply have been a line count.

## Corrections to 05
| Claim in 05 | Actual |
|---|---|
| 11,196 product URLs | correct (11,196 data rows) |
| 59 `KAT<id>` placeholders | **58** |
| 56 equal `KAT`+own old id | correct; the other **2 carry a foreign id** (`260412`→`KAT201647`, `264049`→`KAT71310`) and **neither referenced id exists in the map** |
| 2 empty codes (525945, 523428) | correct |
| 105 codes shared by 226 URLs | **104 codes shared by 224 URLs** |
| 61 unmatched | **64** (see below) |
| 389 categories, "all 389 marked done" | 389 correct; there is **no `done` field** — entries carry only `id`, `name`, `url` |

## url_map.csv — structure (all clean)
- Columns `old_url, old_path, id, code`. Every row matches `/<slug>/pro<id>.html`.
- `id` always agrees with the id in the path; `old_url` is always `https://www.elektrodvorak.cz` + `old_path`, so **the `old_url` column is redundant** — key the redirect table on `old_path`.
- `old_url`, `old_path` and `id` are each **unique, zero duplicates**. The redirect key is safe.
- Old id range 2,643 to 528,204.
- 11,164 distinct slugs: **31 slugs are reused by 63 URLs** (e.g. `fab-home-3h-00-vlozka-cyl-30-35-6klicu` by 3 products), so a slug alone cannot identify a product. Longest slug 133 chars.

## url_map.csv — `code` quality
11,074 distinct non-empty codes. Composition: 6,525 digits only, 3,614 alphanumeric, 1,049 with
ASCII punctuation, 6 non-ASCII, 2 empty.

Normalisation findings, which the Signys matching rule depends on:
- **190 codes are not all-uppercase**, but there are **zero case collisions** — uppercasing is lossless, so normalise case before matching.
- **87 codes contain spaces**, dominated by the JB Sanitary family (`A10 30 00`, `K 10 61 00`, `M 10 60 00`), plus ETA, Lord, Brandt, Romo. Signys may well store these unspaced; matching must be whitespace-insensitive. Note `401539` and `401545` are both `M 10 60 00` — the same code spelled once with and once without the inner space elsewhere in the file.
- **3 rows hold two codes in one field**: `19078060 / A12241`, `28720551 / A20298`, `EA3004 EA30031`. Split on match.
- Stray diacritics to strip: `¨DO540FR` (491242), `8595025353825¨` (261548), `žA246056R` (324262).

Junk in the code column, i.e. the field was used as free text:
- **`473878` has code `NESMÍ NA WEB!!!!`** (`/romo-rhd2073a/`). A staff instruction, not a code. This product must be excluded from the import and the decision confirmed with Bíbo. It also means the old `code` field cannot be trusted as a code field in general.
- `501731` code `-`; `456840` code `halapaš`; `295568` code `Čajčík`.

**64 rows have no usable code** (58 KAT placeholders + 2 empty + `-` + the staff note + 2 free-text words). These need manual mapping or name matching — `06-unmatched-codes.csv` is the worklist.

## The kartotéka problem, quantified
104 codes are shared by 224 old URLs: 93 pairs, 7 triples, 3 quadruples, 1 quintuple. Looking at
the groups, these are mostly **variants that the old site sold as separate products**:

- `ELD109` — four Esperanza URLs differing only by colour (blue, red, black, green)
- `DIN965` — five screw URLs differing by size (M4x30, M5x10, M5x30, M6x30, M4x10 nerez)
- `DIN933` — four hex screws by size
- `3411123` — looks genuinely wrong: three Procraft battery/charger URLs **and** an Einhell cordless trimmer under one code

So the collapse is not purely a data defect. It raises a product question for Bíbo: **should
colour and size variants be one card with variants, or stay separate cards?** Either way 224 old
URLs collapse onto at most 104 new ones, so the redirect table is many-to-one — which the
`old_path` key already handles. `3411123` suggests a handful of groups are real ERP errors and
should be listed for Tresoft.

## categories.json
- Dict keyed by id string; every entry has `id`, `name`, `url`, nothing else. Key, `id` and the id inside the URL always agree. All URLs match `/<slug>/kat<id>.html`.
- 389 categories, ids 8 to 683 — so **roughly 290 ids in that range are absent**, presumably categories deleted over the old site's life. Any old category URL outside the 389 needs a fallback 301, not a 404.
- **6 duplicate names**: `Ostatní` ×4, `Příslušenství` ×3, `Elektroinstalační materiál` ×2, `Ostatní nářadí` ×2, `Figurky` ×2, `Společenské hry` ×2. Name cannot key the tree mapping, and these will collide on slug unless scoped by parent — which we cannot do until `product_urls.json` is back.

## Next, in order
1. Re-upload `product_urls.json` — blocks the category tree and the off-by-one.
2. Signys sample CSV — blocks the whole column interpretation in 05, in particular the match key (`ID_ARTIKL` vs `ID_SKLKARTA`), whether `CAROVYKOD` is populated, whether `PC` is gross or net, and whether `STAVCELKEM` is per branch.
3. Confirm with Bíbo: variants as one card or separate; and that `473878` stays off the web.
4. Give Tresoft the groups that look like real ERP errors, starting with `3411123`.
