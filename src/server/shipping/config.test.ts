import { describe, expect, it } from "vitest";
import { fromHaler } from "@/domain/money";
import { quoteShipping } from "@/domain/shipping";
import { defaultPricing, shippingMethodSchema, toDomainMethod } from "./config";

const base = {
  id: "m1",
  connectionId: "c1",
  carrierCode: "ppl",
  name: "PPL na adresu",
  description: "",
  enabled: true,
  sort: 0,
  vatRateBp: 2100,
  needsPickupPoint: false,
  allowsBulky: false,
};

describe("stored method to domain method", () => {
  it("maps a flat tariff and prices through the domain unchanged", () => {
    const method = shippingMethodSchema.parse({
      ...base,
      pricing: { kind: "flat", priceMinor: 9900, freeOverMinor: 200_000, codFeeMinor: 3900 },
    });

    const quote = quoteShipping(
      toDomainMethod(method),
      { weightKg: 2, volumeM3: null },
      { goodsMinor: fromHaler(150_000), codMinor: fromHaler(0) },
    );
    expect(quote).toMatchObject({ kind: "price", minor: 9900, vatRateBp: 2100 });
  });

  it("carries the free-shipping threshold across", () => {
    const method = shippingMethodSchema.parse({
      ...base,
      pricing: { kind: "flat", priceMinor: 9900, freeOverMinor: 200_000, codFeeMinor: 3900 },
    });
    const quote = quoteShipping(
      toDomainMethod(method),
      { weightKg: 2, volumeM3: null },
      { goodsMinor: fromHaler(200_000), codMinor: fromHaler(0) },
    );
    expect(quote).toMatchObject({ minor: 0 });
  });

  it("maps store pickup to free", () => {
    const method = shippingMethodSchema.parse({ ...base, pricing: { kind: "store_pickup" } });
    expect(
      quoteShipping(
        toDomainMethod(method),
        { weightKg: 40, volumeM3: null },
        { goodsMinor: fromHaler(500_000), codMinor: fromHaler(0) },
      ),
    ).toMatchObject({ minor: 0 });
  });

  it("maps the pallet tariff, and the admin's defaults reproduce the documented price", () => {
    const method = shippingMethodSchema.parse({ ...base, pricing: defaultPricing("fofr_pallet") });
    // 20 kg with no fuel surcharge: (17.52 + 9.542 × 20) + 26 = 234.36 Kč.
    const quote = quoteShipping(
      toDomainMethod(method),
      { weightKg: 20, volumeM3: null },
      { goodsMinor: fromHaler(500_000), codMinor: fromHaler(0) },
    );
    expect(quote).toMatchObject({ kind: "price", minor: 23_436 });
  });

  it("still asks for a manual quote when the feed has no weight", () => {
    const method = shippingMethodSchema.parse({ ...base, pricing: defaultPricing("fofr_pallet") });
    expect(
      quoteShipping(
        toDomainMethod(method),
        { weightKg: null, volumeM3: null },
        { goodsMinor: fromHaler(500_000), codMinor: fromHaler(0) },
      ),
    ).toMatchObject({ kind: "manual_quote" });
  });

  it("rejects a tariff whose kind the domain does not know", () => {
    expect(() => shippingMethodSchema.parse({ ...base, pricing: { kind: "drone" } })).toThrow();
  });

  it("rejects a negative price rather than storing it", () => {
    expect(() =>
      shippingMethodSchema.parse({
        ...base,
        pricing: { kind: "flat", priceMinor: -1, freeOverMinor: null, codFeeMinor: 0 },
      }),
    ).toThrow();
  });
});
