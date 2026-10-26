/**
 * Shipping prices. Carrier tariffs are published as decimal Kč formulas, so the
 * coefficients live in `shipping_methods.pricing` as configuration and the arithmetic
 * is done in Kč, rounded to haléře exactly once at the end.
 */

import type { Minor } from "./money";
import { add, fromKc, toKc, ZERO } from "./money";
import type { RateBp } from "./vat";

export interface Parcel {
  /** Billable weight in kg, from the ERP feed. Null when the feed has none. */
  readonly weightKg: number | null;
  /** Null for the whole catalogue today: Signys sends no dimensions (decision 9). */
  readonly volumeM3: number | null;
}

export interface OrderValue {
  readonly goodsMinor: Minor;
  /** Amount to collect on delivery, zero when the order is paid up front. */
  readonly codMinor: Minor;
}

interface MethodBase {
  readonly id: string;
  readonly vatRateBp: RateBp;
}

export interface PickupMethod extends MethodBase {
  readonly kind: "store_pickup";
}

export interface FlatMethod extends MethodBase {
  readonly kind: "flat" | "own_delivery";
  readonly priceMinor: Minor;
  readonly freeOverMinor: Minor | null;
  readonly codFeeMinor: Minor;
}

/** FOFR pallet freight, Module B (weight) with Module F (volumetric) when dimensions exist. */
export interface FofrMethod extends MethodBase {
  readonly kind: "fofr_pallet";
  readonly baseKc: number;
  readonly perKgKc: number;
  readonly minChargeableKg: number;
  readonly fixedFeeKc: number;
  readonly fuelSurchargeBp: number;
  readonly codRateBp: number;
  /** Module F: 1 m³ counts as this many kg. */
  readonly volumetricKgPerM3: number;
  /** Above this the carrier refuses cash on delivery. */
  readonly codCeilingMinor: Minor;
  /** Above this the consignment is not covered by the carrier's insurance. */
  readonly insuranceLimitMinor: Minor;
}

export type ShippingMethod = PickupMethod | FlatMethod | FofrMethod;

export type ShippingQuote =
  | { readonly kind: "price"; readonly minor: Minor; readonly vatRateBp: RateBp }
  /** Priced by a person: the order goes to a queue instead of showing a wrong number. */
  | { readonly kind: "manual_quote"; readonly reason: string }
  | { readonly kind: "unavailable"; readonly reason: string };

export function chargeableWeightKg(parcel: Parcel, volumetricKgPerM3: number): number | null {
  if (parcel.weightKg === null || !Number.isFinite(parcel.weightKg) || parcel.weightKg <= 0) return null;
  if (parcel.volumeM3 === null || !Number.isFinite(parcel.volumeM3) || parcel.volumeM3 <= 0)
    return parcel.weightKg;
  return Math.max(parcel.weightKg, parcel.volumeM3 * volumetricKgPerM3);
}

function quoteFofr(method: FofrMethod, parcel: Parcel, order: OrderValue): ShippingQuote {
  if (order.goodsMinor > method.insuranceLimitMinor) {
    return { kind: "manual_quote", reason: "goods value above the carrier's insurance limit" };
  }
  if (order.codMinor > method.codCeilingMinor) {
    return { kind: "unavailable", reason: "cash on delivery above the carrier's ceiling" };
  }

  const kg = chargeableWeightKg(parcel, method.volumetricKgPerM3);
  if (kg === null) {
    // Bulky goods with no weight in the feed. Decision 9 leaves these to a person
    // rather than letting the formula invent a price from a missing figure.
    return { kind: "manual_quote", reason: "no billable weight in the ERP feed" };
  }

  const billableKg = Math.max(kg, method.minChargeableKg);
  const freight = (method.baseKc + method.perKgKc * billableKg) * (1 + method.fuelSurchargeBp / 10_000);
  const cod = (method.codRateBp / 10_000) * toKc(order.codMinor);
  return { kind: "price", minor: fromKc(freight + method.fixedFeeKc + cod), vatRateBp: method.vatRateBp };
}

export function quoteShipping(method: ShippingMethod, parcel: Parcel, order: OrderValue): ShippingQuote {
  if (method.kind === "store_pickup") {
    return { kind: "price", minor: ZERO, vatRateBp: method.vatRateBp };
  }
  if (method.kind === "fofr_pallet") {
    return quoteFofr(method, parcel, order);
  }

  const free = method.freeOverMinor !== null && order.goodsMinor >= method.freeOverMinor;
  const base = free ? ZERO : method.priceMinor;
  const cod = order.codMinor > 0 ? method.codFeeMinor : ZERO;
  return { kind: "price", minor: add(base, cod), vatRateBp: method.vatRateBp };
}
