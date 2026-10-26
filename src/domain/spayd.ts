/**
 * SPAYD, the Czech QR payment string. Built here so the bank transfer QR code and the
 * figures in the confirmation email come from one place and cannot drift apart.
 *
 * The format is ASCII only, so Czech text is transliterated rather than passed through:
 * a scanner that meets an accented byte may reject the whole string.
 */

import type { Minor } from "./money";
import { toKc } from "./money";

export interface SpaydPayment {
  readonly iban: string;
  readonly amountMinor: Minor;
  /** Variable symbol, the only thing tying a transfer back to an order. */
  readonly variableSymbol: string;
  readonly message?: string;
  readonly currency?: string;
}

const MESSAGE_MAX = 60;
const VS_MAX = 10;

export function normaliseIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/** ISO 13616 mod-97 check, so a mistyped account is caught before a QR code is printed. */
export function isValidIban(iban: string): boolean {
  const value = normaliseIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value)) return false;

  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

function toAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\x20-\x7E]/g, "");
}

/** `*` and `:` are the format's own separators, so they can never appear in a value. */
function sanitiseMessage(message: string): string {
  return toAscii(message).replace(/[*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX);
}

/** Amounts are written with two decimals and a dot, never a Czech comma. */
function formatAmount(amountMinor: Minor): string {
  if (amountMinor < 0) throw new Error("SPAYD amount must not be negative");
  return (amountMinor / 100).toFixed(2);
}

export function spayd(payment: SpaydPayment): string {
  const iban = normaliseIban(payment.iban);
  if (!isValidIban(iban)) throw new Error(`SPAYD needs a valid IBAN, received ${payment.iban}`);

  const vs = payment.variableSymbol.trim();
  if (!/^\d{1,10}$/.test(vs))
    throw new Error(`variable symbol must be 1 to ${VS_MAX} digits, received ${payment.variableSymbol}`);

  const fields = [
    `ACC:${iban}`,
    `AM:${formatAmount(payment.amountMinor)}`,
    `CC:${payment.currency ?? "CZK"}`,
    `X-VS:${vs}`,
  ];

  const message = payment.message === undefined ? "" : sanitiseMessage(payment.message);
  if (message !== "") fields.push(`MSG:${message}`);

  return `SPD*1.0*${fields.join("*")}`;
}
