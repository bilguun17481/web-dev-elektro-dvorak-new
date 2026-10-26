/**
 * Which branch ships an order. Deterministic by construction: every comparison ends in
 * a tiebreak on `sortId`, so the same order and the same stock always allocate the same
 * way and the result can be reproduced from the order's snapshot when someone asks why.
 *
 * The rule (ARCHITECTURE.md): branches that can ship directly and cover every line,
 * then lowest purchase price, then highest stock, then lowest sort id. An order that the
 * rule cannot decide is flagged for manual allocation rather than guessed (decision 4).
 */

import type { Minor } from "./money";
import { add, ZERO } from "./money";

export interface Branch {
  readonly id: string;
  readonly erpCode: string;
  readonly canShipDirectly: boolean;
  /** Stable tiebreak, so allocation never depends on row order. */
  readonly sortId: number;
}

export interface StockRow {
  readonly productId: string;
  readonly branchId: string;
  readonly qty: number;
  /** From Signys once Tresoft adds it (decision 9); null until then. */
  readonly purchasePriceMinor: Minor | null;
}

export interface DemandLine {
  readonly productId: string;
  readonly qty: number;
}

export interface Allocation {
  readonly productId: string;
  readonly branchId: string;
  readonly qty: number;
}

export type AllocationResult =
  | { readonly kind: "single"; readonly branchId: string; readonly allocations: readonly Allocation[] }
  | { readonly kind: "split"; readonly allocations: readonly Allocation[] }
  | { readonly kind: "manual"; readonly reason: string };

interface Candidate {
  readonly branch: Branch;
  readonly purchasePriceMinor: Minor | null;
  readonly stockQty: number;
}

function stockAt(stock: readonly StockRow[], productId: string, branchId: string): StockRow | undefined {
  return stock.find((row) => row.productId === productId && row.branchId === branchId);
}

/**
 * Ranks candidates by the rule. When any candidate is missing a purchase price the
 * criterion is skipped for the whole comparison: ranking a known price against an
 * unknown one would decide the order on which rows Signys happens to have filled in.
 */
function pickBest(candidates: readonly Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  const usePurchasePrice = candidates.every((c) => c.purchasePriceMinor !== null);

  return (
    [...candidates].sort((a, b) => {
      if (usePurchasePrice) {
        const byPrice = (a.purchasePriceMinor ?? 0) - (b.purchasePriceMinor ?? 0);
        if (byPrice !== 0) return byPrice;
      }
      const byStock = b.stockQty - a.stockQty;
      if (byStock !== 0) return byStock;
      return a.branch.sortId - b.branch.sortId;
    })[0] ?? null
  );
}

function shippableBranches(branches: readonly Branch[]): Branch[] {
  return branches.filter((b) => b.canShipDirectly);
}

function coversEveryLine(branch: Branch, lines: readonly DemandLine[], stock: readonly StockRow[]): boolean {
  return lines.every((line) => (stockAt(stock, line.productId, branch.id)?.qty ?? 0) >= line.qty);
}

export function allocate(
  lines: readonly DemandLine[],
  branches: readonly Branch[],
  stock: readonly StockRow[],
): AllocationResult {
  if (lines.length === 0) return { kind: "manual", reason: "order has no lines" };
  if (lines.some((line) => line.qty <= 0))
    return { kind: "manual", reason: "order has a non-positive quantity" };

  const shippable = shippableBranches(branches);
  if (shippable.length === 0) return { kind: "manual", reason: "no branch can ship directly" };

  // One branch for the whole order is cheaper to pack and to post, so it wins outright.
  const whole = shippable.filter((branch) => coversEveryLine(branch, lines, stock));
  if (whole.length > 0) {
    const best = pickBest(
      whole.map((branch) => ({
        branch,
        purchasePriceMinor: lines.reduce<Minor | null>((sum, line) => {
          const price = stockAt(stock, line.productId, branch.id)?.purchasePriceMinor ?? null;
          return sum === null || price === null ? null : add(sum, price);
        }, ZERO),
        stockQty: lines.reduce((sum, line) => sum + (stockAt(stock, line.productId, branch.id)?.qty ?? 0), 0),
      })),
    );
    if (best !== null) {
      return {
        kind: "single",
        branchId: best.branch.id,
        allocations: lines.map((line) => ({
          productId: line.productId,
          branchId: best.branch.id,
          qty: line.qty,
        })),
      };
    }
  }

  // Otherwise split, but only where each line is wholly covered by one branch. Splitting a
  // single line across branches is a judgement about part shipments, so it goes to a person.
  const allocations: Allocation[] = [];
  for (const line of lines) {
    const candidates = shippable
      .map((branch) => ({ branch, row: stockAt(stock, line.productId, branch.id) }))
      .filter((c) => (c.row?.qty ?? 0) >= line.qty)
      .map(({ branch, row }) => ({
        branch,
        purchasePriceMinor: row?.purchasePriceMinor ?? null,
        stockQty: row?.qty ?? 0,
      }));

    const best = pickBest(candidates);
    if (best === null) {
      const anywhere = shippable.reduce(
        (sum, b) => sum + (stockAt(stock, line.productId, b.id)?.qty ?? 0),
        0,
      );
      return {
        kind: "manual",
        reason:
          anywhere >= line.qty
            ? `line ${line.productId} is only coverable by splitting it across branches`
            : `not enough stock for line ${line.productId}`,
      };
    }
    allocations.push({ productId: line.productId, branchId: best.branch.id, qty: line.qty });
  }

  return { kind: "split", allocations };
}
