# CLAUDE.md (proposed)

Elektro Dvořák e-shop. Next.js 16 App Router on Cloudflare Workers (OpenNext), Supabase Postgres, R2, Resend. Multi-shop core, only `elektrodvorak` ships first. Read `ARCHITECTURE.md` before touching checkout, sync or payments.

## Commands
`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` (Vitest) · `npm run test:db` (pgTAP via Supabase CLI) · `npm run build` · `npm run cf:preview`. CI runs lint, typecheck, test, test:db, build on every PR. Run the same before pushing.

## Language
Code, comments, docs, commit messages: English. Customer UI and content: Czech. Admin: Czech. Czech copy avoids hyphens and dashes as punctuation. Use `Intl` with `cs-CZ` for numbers, dates and plurals (`Intl.PluralRules`), never hand-built strings.

## Hard rules
1. **Money is an integer in haléře** (`*_minor`). No floats. Only `src/domain/money.ts` converts for display. VAT is computed only in `src/domain/vat.ts`.
2. **The server computes every price, discount, shipping fee and VAT.** Never read a total from the client.
3. **Pure domain functions** (`pricing`, `shipping`, `allocation`, `vat`, `spayd`) have no I/O and no framework imports, and need tests for every rule change.
4. **Every API route and webhook validates input with zod.** `any` needs a comment saying why.
5. **Every webhook:** verify signature, store event id (idempotent), re-fetch state from the provider, then change the order. No exceptions.
6. **RLS on every table, deny by default.** New table = RLS + policies + a test in the same migration PR. Never use `user_metadata` for authorisation. Service-role client only in `src/server/db/admin.ts`.
7. **SQL is parameterised.** No string-built queries, no `LIKE` on user input. Discount codes match exactly on the normalised code.
8. **Staff accounts are invite-only.** No public route can create or change a role.
9. **Private files (labels, invoices) live in private storage and are served by short-lived signed URLs.**
10. **ERP-owned fields (code, price, stock, purchase price, VAT class) are never edited in admin or overwritten by content imports.** Admin-owned content is never touched by sync. Update `field_ownership` when adding a column.
11. **Nothing outside `src/adapters/erp` knows whether the source is CSV or API.** Sync is outbound from the LAN only.
12. **No card data on our servers.** Hosted pages or hosted fields only.
13. **Stock is shown per branch and honestly** ("skladem na prodejně X", "do 3 dnů"), never as one invented number.

## Code style
- TypeScript `strict`, `noUncheckedIndexedAccess`. Prettier + ESLint enforced (no manual formatting arguments).
- One statement per line; functions short and named for what they do; no multi-concern functions (checkout is `validate → price → reserve → createOrder → startPayment → notify`).
- Match the neighbouring file's naming and comment density. Comments explain why, not what.
- Result types for expected failures; throw only for bugs.
- Log with the structured logger and always include `order_id`/`sync_run_id` so an order's history can be reconstructed. Never log secrets, full card or bank details, or personal data beyond ids.

## Database
- Numbered migrations only (`supabase/migrations/NNNN_name.sql`), forward only, reviewed. Seeds are in `supabase/seed/` and contain no schema. Nothing is applied to production by hand.
- Changing a migration that has run anywhere is forbidden; add a new one.

## Environments and secrets
local, staging (sandbox gateways, own Supabase project), production. Secrets only in env/Cloudflare/GitHub secrets, never in the repo, never in `NEXT_PUBLIC_*` unless truly public. `.env.example` lists every variable. Live-mode gateway switches and production migrations need Bíbo's explicit go.

## Compliance
Each legal obligation has a row in `COMPLIANCE.md` (where implemented, last checked). Verify current Czech law before implementing; when you change a legal behaviour, update the row and date in the same PR. Accessibility: WCAG 2.2 AA, keyboard and screen reader checked for every new interactive component, axe in CI.

## Working with Bíbo
Direct, concise, numbers first. State assumptions and data limits. Ask before irreversible actions (production migrations, deletes, DNS, live payments). Do not open PRs unless asked.
