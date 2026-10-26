import { describe, expect, it } from "vitest";
import { fromHaler, fromKc } from "./money";
import type { CartLine } from "./pricing";
import { computeTotals, lowestPriceIn, priceLines } from "./pricing";

const line = (overrides: Partial<CartLine> & { unitPriceMinor: CartLine["unitPriceMinor"] }): CartLine => ({
  productId: "p1",
  code: "ETA415690000",
  name: "ETA Tampo",
  vatRateBp: 2100,
  qty: 1,
  ...overrides,
});

describe("priceLines", () => {
  it("multiplies unit price by quantity", () => {
    expect(priceLines([line({ unitPriceMinor: fromKc(1299), qty: 3 })])[0]?.lineTotalMinor).toBe(389700);
  });
});

describe("computeTotals", () => {
  it("totals goods and shipping with VAT included in the displayed price", () => {
    const totals = computeTotals({
      lines: [line({ unitPriceMinor: fromKc(1210), qty: 2 })],
      shipping: { minor: fromKc(121), vatRateBp: 2100 },
      discount: null,
      pricesIncludeVat: true,
    });
    expect(totals.subtotalMinor).toBe(242000);
    expect(totals.shippingMinor).toBe(12100);
    expect(totals.totalMinor).toBe(254100);
    expect(totals.vatMinor).toBe(44100);
    expect(totals.netMinor + totals.vatMinor).toBe(totals.totalMinor);
  });

  it("adds VAT on top when the price level is quoted net", () => {
    const totals = computeTotals({
      lines: [line({ unitPriceMinor: fromKc(1000) })],
      shipping: null,
      discount: null,
      pricesIncludeVat: false,
    });
    expect(totals.subtotalMinor).toBe(100000);
    expect(totals.totalMinor).toBe(121000);
  });

  it("spreads a percentage discount across VAT groups so the breakdown still adds up", () => {
    const totals = computeTotals({
      lines: [
        line({ productId: "a", unitPriceMinor: fromKc(10), vatRateBp: 2100 }),
        line({ productId: "b", unitPriceMinor: fromKc(5), vatRateBp: 1200 }),
      ],
      shipping: null,
      discount: { kind: "percent", percentBp: 1000 },
      pricesIncludeVat: true,
    });
    expect(totals.subtotalMinor).toBe(1500);
    expect(totals.discountMinor).toBe(150);
    expect(totals.totalMinor).toBe(1350);
    expect(totals.netMinor + totals.vatMinor).toBe(totals.totalMinor);
    const discounted = totals.vat.groups.reduce<number>((sum, g) => sum + g.grossMinor, 0);
    expect(discounted).toBe(1350);
  });

  it("keeps the total right when the discount does not divide evenly across groups", () => {
    const totals = computeTotals({
      lines: [
        line({ productId: "a", unitPriceMinor: fromHaler(333), vatRateBp: 2100 }),
        line({ productId: "b", unitPriceMinor: fromHaler(334), vatRateBp: 1200 }),
        line({ productId: "c", unitPriceMinor: fromHaler(333), vatRateBp: 0 }),
      ],
      shipping: null,
      discount: { kind: "percent", percentBp: 1000 },
      pricesIncludeVat: true,
    });
    expect(totals.discountMinor).toBe(100);
    expect(totals.totalMinor).toBe(900);
    expect(totals.netMinor + totals.vatMinor).toBe(totals.totalMinor);
  });

  it("caps a fixed discount at the goods subtotal, so a total never goes negative", () => {
    const totals = computeTotals({
      lines: [line({ unitPriceMinor: fromKc(100) })],
      shipping: { minor: fromKc(90), vatRateBp: 2100 },
      discount: { kind: "fixed", amountMinor: fromKc(500) },
      pricesIncludeVat: true,
    });
    expect(totals.discountMinor).toBe(10000);
    expect(totals.totalMinor).toBe(9000);
  });

  it("zeroes shipping for a free-shipping code without discounting the goods", () => {
    const totals = computeTotals({
      lines: [line({ unitPriceMinor: fromKc(100) })],
      shipping: { minor: fromKc(90), vatRateBp: 2100 },
      discount: { kind: "free_shipping" },
      pricesIncludeVat: true,
    });
    expect(totals.shippingMinor).toBe(0);
    expect(totals.discountMinor).toBe(0);
    expect(totals.totalMinor).toBe(10000);
  });

  it("charges shipping at its own VAT rate", () => {
    const totals = computeTotals({
      lines: [line({ unitPriceMinor: fromKc(100), vatRateBp: 1200 })],
      shipping: { minor: fromKc(100), vatRateBp: 2100 },
      discount: null,
      pricesIncludeVat: true,
    });
    expect(totals.vat.groups.map((g) => g.rateBp)).toEqual([2100, 1200]);
  });

  it("handles an empty cart", () => {
    const totals = computeTotals({ lines: [], shipping: null, discount: null, pricesIncludeVat: true });
    expect(totals.totalMinor).toBe(0);
    expect(totals.vat.groups).toEqual([]);
  });

  it("rejects a nonsense discount percentage", () => {
    expect(() =>
      computeTotals({
        lines: [line({ unitPriceMinor: fromKc(10) })],
        shipping: null,
        discount: { kind: "percent", percentBp: -500 },
        pricesIncludeVat: true,
      }),
    ).toThrow(/non-negative/);
  });
});

describe("lowestPriceIn", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const at = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("finds the lowest price inside the window", () => {
    const lowest = lowestPriceIn(
      [
        { priceMinor: fromKc(1200), validFrom: at(20) },
        { priceMinor: fromKc(999), validFrom: at(10) },
        { priceMinor: fromKc(1100), validFrom: at(2) },
      ],
      now,
    );
    expect(lowest).toBe(99900);
  });

  it("ignores prices older than the window", () => {
    expect(
      lowestPriceIn(
        [
          { priceMinor: fromKc(500), validFrom: at(40) },
          { priceMinor: fromKc(900), validFrom: at(5) },
        ],
        now,
      ),
    ).toBe(90000);
  });

  it("returns null when the window holds no price, rather than inventing a claim", () => {
    expect(lowestPriceIn([{ priceMinor: fromKc(500), validFrom: at(90) }], now)).toBeNull();
    expect(lowestPriceIn([], now)).toBeNull();
  });
});
