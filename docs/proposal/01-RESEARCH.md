# 01 Research: versions, pricing, legal state (checked 2026-10-26)

**Limits of this check.** The sandbox could not reach cloudflare.com, supabase.com, resend.com or opennext.js.org directly (DNS blocked). Package versions come from the npm registry (authoritative). Pricing comes from search snippets of the official pages plus third-party summaries, so every price below is **"confirm on the vendor page before pinning"**. Legal items come from Czech law-firm and trade articles, not from Sbírka zákonů, and several sources contradict each other (called out below).

## Stack versions (npm registry, today)

| Item | Value | Note |
|---|---|---|
| Next.js | **16.4.3**, Node >= 20.9 | [registry](https://registry.npmjs.org/next/latest) |
| @opennextjs/cloudflare | **1.20.13** | peer: `next >=15.5.28 <16 \|\| >=16.4.1`, `wrangler ^4.148.0`. [registry](https://registry.npmjs.org/@opennextjs/cloudflare/latest) |
| Cloudflare's stance | OpenNext adapter is the preferred route; Next on Pages is not | [Cloudflare blog](https://blog.cloudflare.com/ja-jp/deploying-nextjs-apps-to-cloudflare-workers-with-the-opennext-adapter), [opennext.js.org/cloudflare](https://opennext.js.org/cloudflare) |

The Moto prototype already runs Next 16 + this adapter + `nodejs_compat`, so the combination is proven for this team. Pin exact versions in `package.json` (no carets) and bump deliberately.

## Pricing

| Service | Figure | Source / confidence |
|---|---|---|
| Cloudflare Workers Paid | $5/mo; 10 M requests + 30 M CPU-ms included; then $0.30/M requests, $0.02/M CPU-ms | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) via snippets; older guides quote $0.50/M, treat as stale. Medium |
| Cloudflare R2 | $0.015/GB-month, 10 GB free, no egress fee, Class A $4.50/M, Class B $0.36/M | [R2 pricing](https://developers.cloudflare.com/r2/pricing/). High. 10 GB image budget is ~free |
| Supabase Pro | $25/mo; 8 GB disk, 250 GB egress, $10 compute credit (covers one Micro), spend cap on by default | [supabase.com/pricing](https://supabase.com/pricing), [egress docs](https://supabase.com/docs/guides/platform/manage-your-usage/egress). Medium-high |
| Resend | Official table in search shows Pro **$20/mo for 50k emails**; sources conflict on higher tiers; Free is 100 emails/day | [resend.com/pricing](https://www.resend.com/pricing.md). Medium |
| Comgate cards | Start: Visa/MC incl. Apple/Google Pay **free up to 50,000 Kč/mo, then 1 %**. Profi: EU consumer cards **0.67 % + 1 Kč**, EU business cards 2.0 % + 1 Kč, non-EU 2.7 % + 4.5 Kč; refund 5 Kč; chargeback 990 Kč | [Comgate ceníky](https://www.comgate.cz/files/comgate-pczk26pbcz.pdf). Several PDF versions exist; **get the contract price list**. Medium |
| KB API Business | Basic free (statements), **Plus 100 Kč/mo** (transaction history), **Pro 500 Kč/mo** (real-time changes). Not available with tariff Start Business | [kb.cz](https://www.kb.cz/cs/kbapi/extra-sluzba-api-business). High |
| Balíkobot | **No public API price list found.** API v2 recommended for new work; test/prod keys are per shipping location; carriers include Česká pošta, DPD, GLS, PPL, Zásilkovna | [implementátorská příručka](https://www.balikobot.cz/implementatorska-prirucka). Need a quote |

### Running cost vs the 630 to 730 Kč target
Supabase $25 + Workers $5 = $30. At an assumed 22 Kč/USD (**FX not verified**) that is ~660 Kč, plus KB Plus 100 Kč = **~760 Kč, already over the top of the band**. Resend Free (100/day) probably covers launch; Resend Pro would add ~440 Kč. If 20k products × 9 branches of stock plus trigram indexes outgrow a Micro (1 GB RAM), a Small compute adds cost. **Flag: realistic floor is ~760 Kč, ~1,200 Kč with Resend Pro or bigger compute.** Dev/staging Supabase project on Free tier keeps staging at 0.

## Czech and EU legal state

| Item | State found | Confidence |
|---|---|---|
| European Accessibility Act, zákon 424/2023 Sb. | In force for services and products placed after **28. 6. 2025**. Micro-enterprise exemption (<10 staff and <= €2 M) does not apply to Dvořák. Fines up to 10 M Kč. [Bird & Bird](https://cm.twobirds.com/en/insights/2025/czech-republic/czech-republic-new-act-on-accessibility-requirements) | Medium-high |
| Online withdrawal button (Dir. 2023/2673) | EU deadline 19. 6. 2026 **missed by Czechia**; Commission opened infringement 30. 1. 2026. Czech bill passed the Chamber (3rd reading) 10. 7. 2026 with **effective date 1. 1. 2027**; Senate was due from 19. 8. 2026. One blog claims it was published 2. 9. 2026 as **159/2026 Sb.**, unverified. Fine up to 5 M Kč; new Civil Code §1830a. [Právní prostor](https://pravniprostor.cz/clanky/pravo-it/tlacitko-pro-odstoupeni-od-smlouvy-bude-nova-povinna-vybava-e-shopu), [Lupa](https://www.lupa.cz/aktuality/povinne-tlacitko-na-rychle-odstoupeni-od-smlouvy-v-online-prostoru-je-o-krok-bliz/) | Low on final status. **Decision: build it before launch regardless; check Sbírka zákonů** |
| Green claims, Dir. 2024/825 (EmpCo) | Applies from **27. 9. 2026** (already live). Czech transposition disputed: ARROWS says 289/2025 Sb., TÜV SÜD (Sept 2026) says still pending; Commission infringement vs 20 states. Bans generic "eko/zelený", unrecognised labels, offset based "climate neutral" claims. [TÜV SÜD](https://www.tuvsud.com/cs-cz/tisk-a-media/2026/september/zelena-tvrzeni-bez-greenwashingu) | Low on transposition, high on substance. Treat as binding |
| 30-day lowest price (Omnibus), reviews labelling, "zavazuje k platbě" button | **Not re-verified this session.** Background knowledge: in force since 2022 / 2014 | Verify in Phase 1 |
| GPSR (EU 2023/988), DSA basics, EPREL, recyklační příspěvek, VIES/ARES, Consent Mode v2 | **Not researched this session.** Background knowledge only | Verify per item before implementing; tracked in `COMPLIANCE.md` |

Note: the spec's "tlačítková novela" naming covers two different laws (2014 order button, 2026 withdrawal button). `COMPLIANCE.md` will list them separately.

## What the Moto prototype gives us (read, not copied)
Next 16.3 + OpenNext 1.20, `PaymentProvider` interface (`createPayment`, `handleWebhook`, `configured`), six providers in ~30 to 55 lines each, `checkout.ts` 91 lines, a single 251-line init migration, seed data in `supabase/seed.sql` plus two stray `add-gladiator-*.sql` files (the "one-off SQL" smell from the brief). Keep: the provider interface shape, admin shell layout, `wrangler.jsonc` flags (`nodejs_compat`, `global_fetch_strictly_public`). Change: provider `handleWebhook` takes raw Request and returns a result with no signature or idempotency contract; we make both mandatory (see ARCHITECTURE).
