Elektro Dvořák e-shop. Next.js 16 App Router, Tailwind 4, Supabase Postgres. Multi-shop
core, only `elektrodvorak` ships first. Read `docs/proposal/02-ARCHITECTURE.md` before
touching checkout, sync or payments.

## Commands
`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` ·
`npm run data:build` (regenerates the 301 map and category list from the export).
CI runs lint, typecheck, test and build on every push. Run the same before pushing.

## Next.js 16
This is not the Next.js in your training data. Read the relevant page under
`node_modules/next/dist/docs/` before writing routing or data-fetching code. Two things
that have already bitten: `params` and `searchParams` are Promises and must be awaited,
and `middleware.ts` is now `proxy.ts` with a Node runtime that cannot be changed to edge.

## Language
Code, comments, docs and commit messages in English. Customer and admin UI in Czech.
Czech copy avoids hyphens and dashes as punctuation. Format with `Intl` and `cs-CZ`,
never by hand.

## Hard rules
1. **Money is an integer in haléře** behind the branded `Minor` type. No floats. Only
   `src/domain/money.ts` converts for display, only `src/domain/vat.ts` computes VAT.
2. **The server computes every price, discount, shipping fee and VAT.** Never read a
   total from the client. The cart page uses `computeTotals` to display, and checkout
   re-prices from the database and ignores what the client sent.
3. **`src/domain` is pure**: no I/O, no framework, no adapters. ESLint enforces it. Every
   rule change needs a test.
4. **Every API route and webhook validates input with zod.** `any` needs a comment.
5. **Every webhook**: verify signature, store the event id, re-fetch state from the
   provider, then change the order.
6. **RLS on every table, deny by default.** A new table means policies and a test in the
   same migration. Never authorise from `user_metadata`.
7. **ERP-owned fields are never edited in admin, admin content is never touched by sync.**
8. **Stock is shown per branch and honestly**, never as one invented number. The feed is
   an hourly snapshot that is frozen overnight, so a live-looking figure would be a lie.
9. **No card data on our servers.** Hosted pages only.

## Generated files
`src/data/generated/` and `supabase/seed/0002_redirects.sql` come from
`npm run data:build`. Edit the script or the export, never the output.

## Working with Bíbo
Direct, concise, numbers first. State assumptions and data limits. Ask before
irreversible actions. Do not open PRs unless asked.
