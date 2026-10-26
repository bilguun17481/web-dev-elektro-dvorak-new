/**
 * Matching ERP codes. The rules here come from measuring the real export
 * (docs/proposal/06-EXPORT-VERIFIED.md), not from guesswork:
 *
 * - 190 codes are mixed case and none collide when upper cased, so case can go.
 * - 87 contain spaces, and one code appears both spaced and unspaced
 *   (`M 10 60 00` / `M10 60 00`), so inner whitespace cannot be significant.
 * - 3 rows hold two codes in one field (`19078060 / A12241`).
 * - A few carry stray diacritics (`¨DO540FR`, `8595025353825¨`).
 * - 62 rows carry no code at all: `KAT<id>` placeholders, blanks, a dash, and a staff
 *   note (`NESMÍ NA WEB!!!!`) that must never reach the shop.
 *
 * Normalising all 11,196 codes this way produces no collisions, so the transform is
 * lossless on the real data; `erpCode.test.ts` asserts that against the export itself.
 *
 * Note what is deliberately NOT a rule: "has no digit" does not mean "not a code".
 * 27 codes are letters only and most are plainly real (`GOGDRZAKTILTL`, `ELPNEPTUN`,
 * `SMAWAMYCLBK`). Two of them are Czech words that look like junk (`halapaš`, `Čajčík`),
 * but nothing distinguishes them from the rest by shape, so they stay candidates and
 * the Signys feed settles it. Discarding them here would silently lose real products.
 */

/** Codes that are not codes. There is no article number behind any of these. */
const NOT_A_CODE = new Set(["", "-", "--"]);

const KAT_PLACEHOLDER = /^KAT\d+$/;

/** A staff instruction that reached the code column. The product must not be published. */
const DO_NOT_PUBLISH = "NESMI NA WEB";

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * The form two codes are compared in: upper cased, diacritics removed, whitespace
 * dropped. Matching is on this value; the raw code is kept for display and audit.
 */
export function normaliseErpCode(raw: string): string {
  return stripDiacritics(raw).toUpperCase().replace(/\s+/g, "");
}

const SEPARATOR = /\s+[/;,]\s+|\s+(?=[A-Za-z]{1,4}\d)/;

/**
 * Splits a field holding more than one code. A slash separates codes only when it has
 * whitespace around it (`19078060 / A12241`); without it the slash is part of the code
 * (`EP-BAG/micro`, `20/4 TURBO`). A bare space separates only when what follows starts
 * like a code, which keeps `A10 30 00` whole while splitting `EA3004 EA30031`.
 *
 * A split is only accepted when every part carries a digit. Without that check
 * `Lord L1 2.GN`, `Lord C24` and `Lord W15 3.GN` all split at the space and reduce to
 * their brand, `LORD`, which would match three different products onto one ERP card.
 */
export function splitCodeField(raw: string): string[] {
  const whole = normaliseErpCode(raw);
  const parts = stripDiacritics(raw)
    .split(SEPARATOR)
    .map((part) => normaliseErpCode(part))
    .filter((part) => part !== "");

  if (parts.length < 2) return whole === "" ? [] : [whole];
  const everyPartIsCode = parts.every((part) => /\d/.test(part));
  return everyPartIsCode ? parts : [whole];
}

export type CodeVerdict =
  | { readonly kind: "code"; readonly normalised: string; readonly alternates: readonly string[] }
  | { readonly kind: "placeholder"; readonly reason: string }
  | { readonly kind: "blocked"; readonly reason: string };

/**
 * Classifies a raw code from the old site or the ERP feed. `blocked` is kept separate
 * from `placeholder` because the difference decides whether the product may be
 * published at all, not merely whether it can be matched automatically.
 */
export function classifyErpCode(raw: string): CodeVerdict {
  const collapsed = stripDiacritics(raw).trim().toUpperCase().replace(/\s+/g, " ");

  if (collapsed.startsWith(DO_NOT_PUBLISH)) {
    return { kind: "blocked", reason: "marked in the ERP as not for the web" };
  }
  if (NOT_A_CODE.has(collapsed)) {
    return { kind: "placeholder", reason: "empty or a dash" };
  }
  if (KAT_PLACEHOLDER.test(collapsed.replace(/\s+/g, ""))) {
    return { kind: "placeholder", reason: "KAT<id> placeholder, no ERP code exists" };
  }

  const parts = splitCodeField(raw);
  const primary = parts[0];
  if (primary === undefined) return { kind: "placeholder", reason: "nothing left after normalisation" };
  return { kind: "code", normalised: primary, alternates: parts.slice(1) };
}

/**
 * True for codes worth a human glance before launch: a real candidate code that is
 * letters only, so it cannot be told apart from free text by shape. Advisory only,
 * never a reason to drop a row. Rows that are already placeholders or blocked are not
 * flagged, since they need no confirming.
 */
export function needsCodeReview(raw: string): boolean {
  const verdict = classifyErpCode(raw);
  return verdict.kind === "code" && !/\d/.test(verdict.normalised);
}
