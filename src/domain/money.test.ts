import { describe, expect, it } from "vitest";
import {
  add,
  allocateProportionally,
  formatKc,
  fromHaler,
  fromKc,
  mulQty,
  roundHalfUp,
  scale,
  sub,
  toKc,
  ZERO,
} from "./money";

const spaces = (text: string) => text.replace(/\s/g, " ");

describe("conversion", () => {
  it("reads Kč with two decimals exactly", () => {
    expect(fromKc(1234.56)).toBe(123456);
    expect(fromKc(0.01)).toBe(1);
    expect(fromKc(0)).toBe(0);
  });

  it("does not lose a haléř to binary floating point", () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754.
    expect(fromKc(19.99)).toBe(1999);
    expect(fromKc(0.07 * 3)).toBe(21);
  });

  it("rounds half away from zero, symmetrically", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(fromKc(-0.005)).toBe(-1);
  });

  it("rejects a non-integer haléř amount", () => {
    expect(() => fromHaler(1.5)).toThrow(/integer/);
  });

  it("round-trips through Kč", () => {
    expect(toKc(fromKc(849.9))).toBe(849.9);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts", () => {
    expect(add(fromKc(10), fromKc(2.5))).toBe(1250);
    expect(sub(fromKc(10), fromKc(2.5))).toBe(750);
    expect(add()).toBe(0);
  });

  it("multiplies by a fractional quantity, as numeric(12,3) allows", () => {
    expect(mulQty(fromKc(12.5), 1.5)).toBe(1875);
    expect(mulQty(fromKc(3.33), 3)).toBe(999);
  });

  it("refuses a negative quantity", () => {
    expect(() => mulQty(fromKc(1), -1)).toThrow(/non-negative/);
  });

  it("scales by a ratio", () => {
    expect(scale(fromKc(100), 0.21)).toBe(2100);
  });
});

describe("allocateProportionally", () => {
  it("splits evenly when the weights divide the total", () => {
    expect(allocateProportionally(fromKc(1.5), [fromKc(10), fromKc(5)])).toEqual([100, 50]);
  });

  it("gives the leftover haléř to the largest fraction and still sums to the total", () => {
    const parts = allocateProportionally(fromHaler(100), [fromHaler(333), fromHaler(334), fromHaler(333)]);
    expect(parts).toEqual([33, 34, 33]);
    expect(parts.reduce<number>((sum, p) => sum + p, 0)).toBe(100);
  });

  it("never loses or invents a haléř, over every split of an awkward total", () => {
    for (let weight = 1; weight <= 200; weight++) {
      const parts = allocateProportionally(fromHaler(997), [fromHaler(weight), fromHaler(301), fromHaler(7)]);
      expect(parts.reduce<number>((sum, p) => sum + p, 0)).toBe(997);
    }
  });

  it("handles weights that are all zero without dropping the amount", () => {
    expect(allocateProportionally(fromHaler(55), [ZERO, ZERO])).toEqual([55, 0]);
  });

  it("handles an empty weight list", () => {
    expect(allocateProportionally(fromHaler(10), [])).toEqual([]);
  });

  it("distributes a negative total too", () => {
    const parts = allocateProportionally(fromHaler(-100), [fromHaler(1), fromHaler(2)]);
    expect(parts.reduce<number>((sum, p) => sum + p, 0)).toBe(-100);
  });

  it("is deterministic for equal weights", () => {
    expect(allocateProportionally(fromHaler(10), [fromHaler(1), fromHaler(1), fromHaler(1)])).toEqual([
      4, 3, 3,
    ]);
  });
});

describe("formatKc", () => {
  it("hides haléře when the amount is whole Kč", () => {
    expect(spaces(formatKc(fromKc(12990)))).toBe("12 990 Kč");
  });

  it("shows haléře when the amount has them", () => {
    expect(spaces(formatKc(fromKc(12.5)))).toContain("12,50");
  });
});
