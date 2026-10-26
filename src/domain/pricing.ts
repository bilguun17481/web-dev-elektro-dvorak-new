/**
 * Order totals. The server calls this and nothing else to price a cart; a total that
 * arrives from the client is only ever compared, never trusted.
 */

import type { Minor } from "./money";
import { add, allocateProportionally, clampToZero, minOf, mulQty, scale, sub, ZERO } from "./money";
import type { RateBp, VatBreakdown } from "./vat";
import { vatBreakdown } from "./vat";

export interface CartLine {
  readonly productId: string;
  /** ERP code, snapshotted onto the order so later catalogue edits cannot rewrite history. */
  readonly code: string;
  readonly name: string;
  readonly unitPriceMinor: Minor;
  readonly vatRateBp: RateBp;
  readonly qty: number;
}

export interface PricedLine extends CartLine {
  readonly lineTotalMinor: Minor;
}

export type Discount =
  | { readonly kind: "percent"; readonly percentBp: number }
  | { readonly kind: "fixed"; readonly amountMinor: Minor }
  | { readonly kind: "free_shipping" };

export interface ShippingCharge {
  readonly minor: Minor;
  readonly vatRateBp: RateBp;
}

export interface TotalsInput {
  readonly lines: readonly CartLine[];
  readonly shipping: ShippingCharge | null;
  readonly discount: Discount | null;
  /** `shops.vat_display`: Czech B2C prices include VAT, a B2B price level may not. */
  readonly pricesIncludeVat: boolean;
}

export interface Totals {
  readonly lines: readonly PricedLine[];
  /** Goods before discount, in the shop's display mode. */
  readonly subtotalMinor: Minor;
  readonly discountMinor: Minor;
  readonly shippingMinor: Minor;
  readonly vat: VatBreakdown;
  readonly vatMinor: Minor;
  readonly netMinor: Minor;
  /** What the customer pays. */
  readonly totalMinor: Minor;
}

export function priceLines(lines: readonly CartLine[]): PricedLine[] {
  return lines.map((line) => ({ ...line, lineTotalMinor: mulQty(line.unitPriceMinor, line.qty) }));
}

function discountOnGoods(discount: Discount | null, subtotalMinor: Minor): Minor {
  if (discount === null) return ZERO;
  if (discount.kind === "percent") {
    if (!Number.isInteger(discount.percentBp) || discount.percentBp < 0)
      throw new Error(`percentBp must be a non-negative integer, received ${discount.percentBp}`);
    return minOf(scale(subtotalMinor, discount.percentBp / 10_000), subtotalMinor);
  }
  if (discount.kind === "fixed") return minOf(clampToZero(discount.amountMinor), subtotalMinor);
  return ZERO;
}

export function computeTotals(input: TotalsInput): Totals {
  const lines = priceLines(input.lines);
  const subtotalMinor = add(...lines.map((l) => l.lineTotalMinor));

  const freeShipping = input.discount?.kind === "free_shipping";
  const shippingMinor = freeShipping || input.shipping === null ? ZERO : input.shipping.minor;
  const discountMinor = discountOnGoods(input.discount, subtotalMinor);

  // A discount reduces each VAT group in proportion to its share of the goods, so the
  // breakdown still adds up to the total. Allocating proportionally keeps the parts
  // summing to exactly the discount instead of drifting by a haléř per group.
  const goodsByRate = new Map<RateBp, Minor>();
  for (const line of lines) {
    goodsByRate.set(line.vatRateBp, add(goodsByRate.get(line.vatRateBp) ?? ZERO, line.lineTotalMinor));
  }
  const rates = [...goodsByRate.keys()];
  const grossPerRate = rates.map((rate) => goodsByRate.get(rate) ?? ZERO);
  const discountPerRate = allocateProportionally(discountMinor, grossPerRate);

  const taxable = rates.map((rateBp, i) => ({
    rateBp,
    amountMinor: sub(grossPerRate[i] ?? ZERO, discountPerRate[i] ?? ZERO),
  }));
  if (shippingMinor !== 0 && input.shipping !== null) {
    taxable.push({ rateBp: input.shipping.vatRateBp, amountMinor: shippingMinor });
  }

  const vat = vatBreakdown(taxable, input.pricesIncludeVat);
  const totalMinor = input.pricesIncludeVat ? vat.grossMinor : add(vat.baseMinor, vat.vatMinor);

  return {
    lines,
    subtotalMinor,
    discountMinor,
    shippingMinor,
    vat,
    vatMinor: vat.vatMinor,
    netMinor: vat.baseMinor,
    totalMinor,
  };
}

export interface PricePoint {
  readonly priceMinor: Minor;
  readonly validFrom: Date;
}

/**
 * Lowest price in the window before `now`, for the "lowest price in the last 30 days"
 * line that has to sit next to a discount claim. Returns null when the window holds no
 * price, so the caller shows no claim rather than an invented one.
 */
export function lowestPriceIn(history: readonly PricePoint[], now: Date, windowDays = 30): Minor | null {
  const from = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const inWindow = history.filter(
    (p) => p.validFrom.getTime() >= from && p.validFrom.getTime() <= now.getTime(),
  );
  if (inWindow.length === 0) return null;
  return inWindow.reduce<Minor>((lowest, p) => minOf(lowest, p.priceMinor), inWindow[0]!.priceMinor);
}
