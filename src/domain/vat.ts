/**
 * The only place VAT is computed. Rates are data, not constants baked into logic:
 * they come from the product's VAT class in the ERP feed, so a statutory change is a
 * data change. Rates are held in basis points to keep them integers (2100 = 21 %).
 */

import type { Minor } from "./money";
import { add, scale, sub, ZERO } from "./money";

export type RateBp = number;

/**
 * Starting set for the Czech Republic. These are seed values for the `vat_rates`
 * table, not a statement of current law: confirm against the Finanční správa before
 * launch and whenever a rate changes, then update the seed rather than this file.
 */
export const CZ_VAT_RATES_SEED: readonly RateBp[] = [2100, 1200, 0];

export interface TaxableAmount {
  readonly amountMinor: Minor;
  readonly rateBp: RateBp;
}

export interface VatGroup {
  readonly rateBp: RateBp;
  readonly baseMinor: Minor;
  readonly vatMinor: Minor;
  readonly grossMinor: Minor;
}

export interface VatBreakdown {
  readonly groups: readonly VatGroup[];
  readonly baseMinor: Minor;
  readonly vatMinor: Minor;
  readonly grossMinor: Minor;
}

function rateFraction(rateBp: RateBp): number {
  return rateBp / 10_000;
}

/**
 * VAT is computed once per rate group on the summed amount, never per line.
 * Summing per-line VAT drifts from the figure on the invoice, because each line
 * would round on its own.
 */
export function vatBreakdown(amounts: readonly TaxableAmount[], pricesIncludeVat: boolean): VatBreakdown {
  const byRate = new Map<RateBp, Minor>();
  for (const { amountMinor, rateBp } of amounts) {
    if (!Number.isInteger(rateBp) || rateBp < 0)
      throw new Error(`VAT rate must be a non-negative integer in basis points, received ${rateBp}`);
    byRate.set(rateBp, add(byRate.get(rateBp) ?? ZERO, amountMinor));
  }

  const groups: VatGroup[] = [];
  for (const rateBp of [...byRate.keys()].sort((a, b) => b - a)) {
    const amount = byRate.get(rateBp) ?? ZERO;
    if (amount === 0) continue;
    const rate = rateFraction(rateBp);

    if (pricesIncludeVat) {
      const vatMinor = scale(amount, rate / (1 + rate));
      groups.push({ rateBp, baseMinor: sub(amount, vatMinor), vatMinor, grossMinor: amount });
    } else {
      const vatMinor = scale(amount, rate);
      groups.push({ rateBp, baseMinor: amount, vatMinor, grossMinor: add(amount, vatMinor) });
    }
  }

  return {
    groups,
    baseMinor: add(...groups.map((g) => g.baseMinor)),
    vatMinor: add(...groups.map((g) => g.vatMinor)),
    grossMinor: add(...groups.map((g) => g.grossMinor)),
  };
}
