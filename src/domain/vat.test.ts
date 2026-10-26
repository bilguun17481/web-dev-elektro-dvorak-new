import { describe, expect, it } from "vitest";
import { fromHaler, fromKc } from "./money";
import { vatBreakdown } from "./vat";

describe("vatBreakdown", () => {
  it("extracts VAT from a gross amount", () => {
    const result = vatBreakdown([{ amountMinor: fromKc(1210), rateBp: 2100 }], true);
    expect(result.groups).toEqual([{ rateBp: 2100, baseMinor: 100000, vatMinor: 21000, grossMinor: 121000 }]);
    expect(result.grossMinor).toBe(121000);
  });

  it("adds VAT to a net amount", () => {
    const result = vatBreakdown([{ amountMinor: fromKc(1000), rateBp: 2100 }], false);
    expect(result.groups).toEqual([{ rateBp: 2100, baseMinor: 100000, vatMinor: 21000, grossMinor: 121000 }]);
  });

  it("computes VAT once per rate group, not per line", () => {
    // Two 10.00 Kč gross lines at 21 %. Rounding each line on its own gives 174 + 174 = 348;
    // the figure that belongs on the invoice is 347, from the summed base.
    const twoLines = vatBreakdown(
      [
        { amountMinor: fromKc(10), rateBp: 2100 },
        { amountMinor: fromKc(10), rateBp: 2100 },
      ],
      true,
    );
    expect(twoLines.vatMinor).toBe(347);
  });

  it("keeps rate groups apart and orders them from the highest rate", () => {
    const result = vatBreakdown(
      [
        { amountMinor: fromKc(100), rateBp: 1200 },
        { amountMinor: fromKc(100), rateBp: 2100 },
        { amountMinor: fromKc(50), rateBp: 1200 },
      ],
      true,
    );
    expect(result.groups.map((g) => g.rateBp)).toEqual([2100, 1200]);
    expect(result.groups[1]?.grossMinor).toBe(15000);
  });

  it("carries a zero-rated group with no VAT", () => {
    const result = vatBreakdown([{ amountMinor: fromKc(200), rateBp: 0 }], true);
    expect(result.vatMinor).toBe(0);
    expect(result.baseMinor).toBe(20000);
  });

  it("drops a group that nets to nothing", () => {
    expect(vatBreakdown([{ amountMinor: fromHaler(0), rateBp: 2100 }], true).groups).toEqual([]);
  });

  it("always has base plus VAT equal to gross, for every rate", () => {
    for (const rateBp of [0, 1200, 2100]) {
      for (const haler of [1, 7, 99, 12345, 999999]) {
        const result = vatBreakdown([{ amountMinor: fromHaler(haler), rateBp }], true);
        expect(result.baseMinor + result.vatMinor).toBe(result.grossMinor);
      }
    }
  });

  it("rejects a nonsense rate", () => {
    expect(() => vatBreakdown([{ amountMinor: fromKc(1), rateBp: -1 }], true)).toThrow(/basis points/);
    expect(() => vatBreakdown([{ amountMinor: fromKc(1), rateBp: 21.5 }], true)).toThrow(/basis points/);
  });
});
