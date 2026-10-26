import { describe, expect, it } from "vitest";
import { fromKc } from "./money";
import type { Branch, StockRow } from "./allocation";
import { allocate } from "./allocation";

const branch = (id: string, sortId: number, canShipDirectly = true): Branch => ({
  id,
  erpCode: id.toUpperCase(),
  canShipDirectly,
  sortId,
});

const golcuv = branch("golcuv", 1);
const caslav = branch("caslav", 2);
const chotebor = branch("chotebor", 3);

const stock = (
  branchId: string,
  productId: string,
  qty: number,
  purchaseKc: number | null = null,
): StockRow => ({
  productId,
  branchId,
  qty,
  purchasePriceMinor: purchaseKc === null ? null : fromKc(purchaseKc),
});

describe("single branch", () => {
  it("ships from the one branch that covers the order", () => {
    const result = allocate(
      [{ productId: "a", qty: 2 }],
      [golcuv, caslav],
      [stock("golcuv", "a", 1), stock("caslav", "a", 5)],
    );
    expect(result).toEqual({
      kind: "single",
      branchId: "caslav",
      allocations: [{ productId: "a", branchId: "caslav", qty: 2 }],
    });
  });

  it("prefers one branch for the whole order even when another is cheaper for one line", () => {
    const result = allocate(
      [
        { productId: "a", qty: 1 },
        { productId: "b", qty: 1 },
      ],
      [golcuv, caslav],
      [stock("golcuv", "a", 5, 100), stock("golcuv", "b", 5, 100), stock("caslav", "a", 5, 10)],
    );
    expect(result).toMatchObject({ kind: "single", branchId: "golcuv" });
  });

  it("skips a branch that cannot ship directly", () => {
    const result = allocate(
      [{ productId: "a", qty: 1 }],
      [branch("depot", 0, false), caslav],
      [stock("depot", "a", 99), stock("caslav", "a", 1)],
    );
    expect(result).toMatchObject({ kind: "single", branchId: "caslav" });
  });
});

describe("tiebreaks", () => {
  it("takes the lowest purchase price first", () => {
    const result = allocate(
      [{ productId: "a", qty: 1 }],
      [golcuv, caslav],
      [stock("golcuv", "a", 2, 500), stock("caslav", "a", 2, 450)],
    );
    expect(result).toMatchObject({ branchId: "caslav" });
  });

  it("falls back to the highest stock when the purchase price is equal", () => {
    const result = allocate(
      [{ productId: "a", qty: 1 }],
      [golcuv, caslav],
      [stock("golcuv", "a", 2, 500), stock("caslav", "a", 9, 500)],
    );
    expect(result).toMatchObject({ branchId: "caslav" });
  });

  it("ignores purchase price entirely when any candidate is missing it", () => {
    // Otherwise the choice would turn on which rows Signys happens to have filled in.
    const result = allocate(
      [{ productId: "a", qty: 1 }],
      [golcuv, caslav],
      [stock("golcuv", "a", 9, null), stock("caslav", "a", 2, 1)],
    );
    expect(result).toMatchObject({ branchId: "golcuv" });
  });

  it("settles a full tie on sort id, so the result is reproducible", () => {
    const result = allocate(
      [{ productId: "a", qty: 1 }],
      [chotebor, caslav, golcuv],
      [stock("golcuv", "a", 3, 100), stock("caslav", "a", 3, 100), stock("chotebor", "a", 3, 100)],
    );
    expect(result).toMatchObject({ branchId: "golcuv" });
  });

  it("gives the same answer whatever order the branches and stock arrive in", () => {
    const lines = [{ productId: "a", qty: 1 }];
    const rows = [stock("golcuv", "a", 3, 100), stock("caslav", "a", 3, 100), stock("chotebor", "a", 5, 100)];
    const first = allocate(lines, [golcuv, caslav, chotebor], rows);
    const second = allocate(lines, [chotebor, golcuv, caslav], [...rows].reverse());
    expect(second).toEqual(first);
  });
});

describe("split across branches", () => {
  it("splits when no single branch covers every line", () => {
    const result = allocate(
      [
        { productId: "a", qty: 1 },
        { productId: "b", qty: 1 },
      ],
      [golcuv, caslav],
      [stock("golcuv", "a", 1), stock("caslav", "b", 1)],
    );
    expect(result).toEqual({
      kind: "split",
      allocations: [
        { productId: "a", branchId: "golcuv", qty: 1 },
        { productId: "b", branchId: "caslav", qty: 1 },
      ],
    });
  });
});

describe("manual allocation", () => {
  it("flags a line that only the branches together could cover", () => {
    const result = allocate(
      [{ productId: "a", qty: 4 }],
      [golcuv, caslav],
      [stock("golcuv", "a", 2), stock("caslav", "a", 2)],
    );
    expect(result).toEqual({
      kind: "manual",
      reason: "line a is only coverable by splitting it across branches",
    });
  });

  it("flags stock that is simply not there", () => {
    const result = allocate([{ productId: "a", qty: 10 }], [golcuv], [stock("golcuv", "a", 1)]);
    expect(result).toMatchObject({ kind: "manual", reason: "not enough stock for line a" });
  });

  it("flags an order no branch can ship", () => {
    const result = allocate(
      [{ productId: "a", qty: 1 }],
      [branch("depot", 0, false)],
      [stock("depot", "a", 5)],
    );
    expect(result).toMatchObject({ kind: "manual", reason: "no branch can ship directly" });
  });

  it("rejects an empty or nonsense order", () => {
    expect(allocate([], [golcuv], [])).toMatchObject({ kind: "manual", reason: "order has no lines" });
    expect(allocate([{ productId: "a", qty: 0 }], [golcuv], [])).toMatchObject({
      reason: "order has a non-positive quantity",
    });
  });
});
