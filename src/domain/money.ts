/**
 * Money is an integer number of haléře, never a float. `0.1 + 0.2 !== 0.3`, and an
 * invoice that is one haléř out is a support call. Only this module converts between
 * haléře and the decimal Kč used for display and for the few external formulas
 * (carrier tariffs) that are published in decimal form.
 */

declare const minorBrand: unique symbol;

/** An integer amount in haléře. The brand stops Kč being passed where haléře are expected. */
export type Minor = number & { readonly [minorBrand]: true };

const HALER_PER_KC = 100;

/** Rounds half away from zero, so 2.5 becomes 3 and -2.5 becomes -3. */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function fromHaler(haler: number): Minor {
  if (!Number.isInteger(haler)) throw new Error(`haléře must be an integer, received ${haler}`);
  return haler as Minor;
}

/** Kč as written in a price list, with at most two decimals. */
export function fromKc(kc: number): Minor {
  if (!Number.isFinite(kc)) throw new Error(`Kč must be finite, received ${kc}`);
  return roundHalfUp(kc * HALER_PER_KC) as Minor;
}

export function toKc(amount: Minor): number {
  return amount / HALER_PER_KC;
}

export const ZERO: Minor = fromHaler(0);

export function add(...amounts: readonly Minor[]): Minor {
  return amounts.reduce<number>((sum, a) => sum + a, 0) as Minor;
}

export function sub(a: Minor, b: Minor): Minor {
  return (a - b) as Minor;
}

export function negate(a: Minor): Minor {
  return -a as Minor;
}

/** Quantities are `numeric(12,3)` in the database, so a line may be 1.5 kg. */
export function mulQty(unit: Minor, qty: number): Minor {
  if (!Number.isFinite(qty) || qty < 0)
    throw new Error(`quantity must be finite and non-negative, received ${qty}`);
  return roundHalfUp(unit * qty) as Minor;
}

/** Multiplies by a ratio, e.g. a VAT rate or a percentage discount. */
export function scale(amount: Minor, factor: number): Minor {
  if (!Number.isFinite(factor)) throw new Error(`factor must be finite, received ${factor}`);
  return roundHalfUp(amount * factor) as Minor;
}

export function clampToZero(amount: Minor): Minor {
  return (amount < 0 ? 0 : amount) as Minor;
}

export function minOf(a: Minor, b: Minor): Minor {
  return (a < b ? a : b) as Minor;
}

export function maxOf(a: Minor, b: Minor): Minor {
  return (a > b ? a : b) as Minor;
}

/**
 * Splits `total` across `weights` so that the parts sum to exactly `total`.
 *
 * Needed wherever one amount has to be spread over several rows, such as an order
 * level discount across VAT rate groups: rounding each part independently loses or
 * invents haléře, which then shows up as a total that does not add up. Uses the
 * largest remainder method, and gives the remaining haléře to the largest weights
 * first so the result is deterministic. Ties go to the earlier index.
 */
export function allocateProportionally(total: Minor, weights: readonly Minor[]): Minor[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce<number>((sum, w) => sum + w, 0);
  if (weightSum === 0) {
    // Nothing to weigh by: put everything on the first row rather than dropping it.
    return weights.map((_, i) => (i === 0 ? total : 0) as Minor);
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((sum, v) => sum + v, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value), weight: weights[index] ?? 0 }))
    .sort((a, b) => b.fraction - a.fraction || b.weight - a.weight || a.index - b.index);

  const parts = [...floors];
  for (const { index } of order) {
    if (remainder === 0) break;
    const step = remainder > 0 ? 1 : -1;
    parts[index] = (parts[index] ?? 0) + step;
    remainder -= step;
  }
  return parts as Minor[];
}

const wholeKc = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const withHaler = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Czech prices are shown without haléře unless the amount actually has them. */
export function formatKc(amount: Minor): string {
  const kc = toKc(amount);
  return amount % HALER_PER_KC === 0 ? wholeKc.format(kc) : withHaler.format(kc);
}
