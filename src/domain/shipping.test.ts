import { describe, expect, it } from "vitest";
import { fromKc, ZERO } from "./money";
import type { FlatMethod, FofrMethod, PickupMethod } from "./shipping";
import { chargeableWeightKg, quoteShipping } from "./shipping";

const pickup: PickupMethod = { id: "store", kind: "store_pickup", vatRateBp: 2100 };

const parcelShop: FlatMethod = {
  id: "packeta",
  kind: "flat",
  vatRateBp: 2100,
  priceMinor: fromKc(79),
  freeOverMinor: fromKc(2000),
  codFeeMinor: fromKc(29),
};

/** Coefficients as specified in ARCHITECTURE.md; they live in shipping_methods.pricing. */
const fofr: FofrMethod = {
  id: "fofr",
  kind: "fofr_pallet",
  vatRateBp: 2100,
  baseKc: 17.52,
  perKgKc: 9.542,
  minChargeableKg: 15.65,
  fixedFeeKc: 26,
  fuelSurchargeBp: 0,
  codRateBp: 150,
  volumetricKgPerM3: 122,
  codCeilingMinor: fromKc(21_600),
  insuranceLimitMinor: fromKc(25_000),
};

const parcel = (weightKg: number | null, volumeM3: number | null = null) => ({ weightKg, volumeM3 });
const order = (goodsKc: number, codKc = 0) => ({ goodsMinor: fromKc(goodsKc), codMinor: fromKc(codKc) });

describe("store pickup", () => {
  it("is free", () => {
    expect(quoteShipping(pickup, parcel(40), order(5000))).toEqual({
      kind: "price",
      minor: 0,
      vatRateBp: 2100,
    });
  });
});

describe("flat rate", () => {
  it("charges the flat price below the free-shipping threshold", () => {
    expect(quoteShipping(parcelShop, parcel(2), order(1500))).toMatchObject({ minor: 7900 });
  });

  it("is free at and above the threshold", () => {
    expect(quoteShipping(parcelShop, parcel(2), order(2000))).toMatchObject({ minor: 0 });
    expect(quoteShipping(parcelShop, parcel(2), order(2500))).toMatchObject({ minor: 0 });
  });

  it("adds the cash-on-delivery fee, and still charges it when shipping is free", () => {
    expect(quoteShipping(parcelShop, parcel(2), order(1500, 1500))).toMatchObject({ minor: 10800 });
    expect(quoteShipping(parcelShop, parcel(2), order(2500, 2500))).toMatchObject({ minor: 2900 });
  });
});

describe("FOFR Module B", () => {
  it("prices by weight: (17.52 + 9.542 kg) + 26", () => {
    // 20 kg: (17.52 + 190.84) + 26 = 234.36 Kč
    expect(quoteShipping(fofr, parcel(20), order(5000))).toEqual({
      kind: "price",
      minor: 23436,
      vatRateBp: 2100,
    });
  });

  it("applies the minimum chargeable weight of 15.65 kg", () => {
    // (17.52 + 9.542 × 15.65) + 26 = 192.8523 Kč
    expect(quoteShipping(fofr, parcel(10), order(5000))).toMatchObject({ minor: 19285 });
    expect(quoteShipping(fofr, parcel(15.65), order(5000))).toMatchObject({ minor: 19285 });
  });

  it("applies the fuel surcharge to the freight but not to the fixed fee", () => {
    const withFuel = { ...fofr, fuelSurchargeBp: 1000 };
    // 166.8523 × 1.1 + 26 = 209.53753 Kč
    expect(quoteShipping(withFuel, parcel(10), order(5000))).toMatchObject({ minor: 20954 });
  });

  it("adds 1.5 % of the cash-on-delivery amount", () => {
    // 192.8523 + 0.015 × 10 000 = 342.8523 Kč
    expect(quoteShipping(fofr, parcel(10), order(12_000, 10_000))).toMatchObject({ minor: 34285 });
  });

  it("asks for a manual quote when the feed carries no weight", () => {
    expect(quoteShipping(fofr, parcel(null), order(5000))).toEqual({
      kind: "manual_quote",
      reason: "no billable weight in the ERP feed",
    });
    expect(quoteShipping(fofr, parcel(0), order(5000))).toMatchObject({ kind: "manual_quote" });
  });

  it("refuses cash on delivery above the carrier ceiling", () => {
    expect(quoteShipping(fofr, parcel(20), order(22_000, 21_601))).toMatchObject({ kind: "unavailable" });
  });

  it("asks for a manual quote above the insurance limit", () => {
    expect(quoteShipping(fofr, parcel(20), order(25_001))).toEqual({
      kind: "manual_quote",
      reason: "goods value above the carrier's insurance limit",
    });
  });

  it("checks the insurance limit before the weight, so a valuable order is quoted not refused", () => {
    expect(quoteShipping(fofr, parcel(null), order(30_000))).toMatchObject({
      reason: "goods value above the carrier's insurance limit",
    });
  });
});

describe("chargeableWeightKg (Module F)", () => {
  it("uses real weight when no dimensions are known, which is every product today", () => {
    expect(chargeableWeightKg(parcel(20), 122)).toBe(20);
  });

  it("takes the greater of real and volumetric weight once dimensions exist", () => {
    expect(chargeableWeightKg(parcel(20, 0.5), 122)).toBe(61);
    expect(chargeableWeightKg(parcel(100, 0.5), 122)).toBe(100);
  });

  it("is null without a usable weight", () => {
    expect(chargeableWeightKg(parcel(null), 122)).toBeNull();
    expect(chargeableWeightKg(parcel(-5), 122)).toBeNull();
  });
});

describe("own delivery", () => {
  it("is priced flat and ignores the parcel", () => {
    const van: FlatMethod = {
      id: "van",
      kind: "own_delivery",
      vatRateBp: 2100,
      priceMinor: fromKc(390),
      freeOverMinor: null,
      codFeeMinor: ZERO,
    };
    expect(quoteShipping(van, parcel(null), order(50_000))).toMatchObject({ minor: 39000 });
  });
});
