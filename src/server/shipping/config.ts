import { z } from "zod";
import { fromHaler } from "@/domain/money";
import type { ShippingMethod as DomainShippingMethod } from "@/domain/shipping";

/**
 * The shape of what the admin stores, and the one place it becomes something
 * `src/domain/shipping.ts` can price with.
 *
 * Tariffs are data, including the FOFR coefficients: a fuel surcharge changing is
 * somebody editing a field, not a deploy. The domain never sees this shape, and this
 * file never computes a price.
 */

const minor = z.number().int();

/** Spread into each member rather than intersected: a discriminated union needs plain objects. */
const flatFields = {
  priceMinor: minor.nonnegative(),
  freeOverMinor: minor.nonnegative().nullable(),
  codFeeMinor: minor.nonnegative(),
};

const palletFields = {
  baseKc: z.number().nonnegative(),
  perKgKc: z.number().nonnegative(),
  minChargeableKg: z.number().nonnegative(),
  fixedFeeKc: z.number().nonnegative(),
  fuelSurchargeBp: z.number().int().nonnegative(),
  codRateBp: z.number().int().nonnegative(),
  volumetricKgPerM3: z.number().positive(),
  codCeilingMinor: minor.nonnegative(),
  insuranceLimitMinor: minor.nonnegative(),
};

export const pricingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("store_pickup") }),
  z.object({ kind: z.literal("flat"), ...flatFields }),
  z.object({ kind: z.literal("own_delivery"), ...flatFields }),
  z.object({ kind: z.literal("fofr_pallet"), ...palletFields }),
]);

export type StoredPricing = z.infer<typeof pricingSchema>;

export const shippingMethodSchema = z.object({
  id: z.string().min(1),
  connectionId: z.string().min(1),
  /** Which carrier of the connection this method ships with, e.g. `ppl` on Balíkobot. */
  carrierCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  enabled: z.boolean(),
  sort: z.number().int(),
  vatRateBp: z.number().int().nonnegative(),
  needsPickupPoint: z.boolean(),
  /** Whether bulky goods may go this way at all. */
  allowsBulky: z.boolean(),
  pricing: pricingSchema,
});

export type StoredShippingMethod = z.infer<typeof shippingMethodSchema>;

export const carrierConnectionSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  enabled: z.boolean(),
  /** Plain settings as entered. Secret fields hold an encrypted envelope, never a value. */
  credentials: z.record(z.string(), z.string()),
  /** Which keys hold an encrypted envelope, so reads know what to decrypt. */
  secretKeys: z.array(z.string()),
  /** Carriers the provider reported last time the connection was tested. */
  carriers: z.array(z.object({ code: z.string(), label: z.string() })).default([]),
  lastTestedAt: z.string().nullable(),
  lastTestOk: z.boolean().nullable(),
  lastTestMessage: z.string().nullable(),
});

export type StoredCarrierConnection = z.infer<typeof carrierConnectionSchema>;

/**
 * Turns what the admin stored into what the domain prices with. The discriminated union
 * means a method whose kind the domain does not know cannot be built by accident.
 */
export function toDomainMethod(method: StoredShippingMethod): DomainShippingMethod {
  const base = { id: method.id, vatRateBp: method.vatRateBp };
  const pricing = method.pricing;

  if (pricing.kind === "store_pickup") {
    return { ...base, kind: "store_pickup" };
  }

  if (pricing.kind === "fofr_pallet") {
    return {
      ...base,
      kind: "fofr_pallet",
      baseKc: pricing.baseKc,
      perKgKc: pricing.perKgKc,
      minChargeableKg: pricing.minChargeableKg,
      fixedFeeKc: pricing.fixedFeeKc,
      fuelSurchargeBp: pricing.fuelSurchargeBp,
      codRateBp: pricing.codRateBp,
      volumetricKgPerM3: pricing.volumetricKgPerM3,
      codCeilingMinor: fromHaler(pricing.codCeilingMinor),
      insuranceLimitMinor: fromHaler(pricing.insuranceLimitMinor),
    };
  }

  return {
    ...base,
    kind: pricing.kind,
    priceMinor: fromHaler(pricing.priceMinor),
    freeOverMinor: pricing.freeOverMinor === null ? null : fromHaler(pricing.freeOverMinor),
    codFeeMinor: fromHaler(pricing.codFeeMinor),
  };
}

/** Sensible starting values so adding a method is filling in a name, not a tariff sheet. */
export function defaultPricing(kind: StoredPricing["kind"]): StoredPricing {
  if (kind === "store_pickup") return { kind };
  if (kind === "fofr_pallet") {
    // The Module B coefficients from ARCHITECTURE.md. Every one of them is editable.
    return {
      kind,
      baseKc: 17.52,
      perKgKc: 9.542,
      minChargeableKg: 15.65,
      fixedFeeKc: 26,
      fuelSurchargeBp: 0,
      codRateBp: 150,
      volumetricKgPerM3: 122,
      codCeilingMinor: 2_160_000,
      insuranceLimitMinor: 2_500_000,
    };
  }
  return { kind, priceMinor: 9900, freeOverMinor: null, codFeeMinor: 3900 };
}
