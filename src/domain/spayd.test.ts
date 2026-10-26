import { describe, expect, it } from "vitest";
import { fromKc } from "./money";
import { isValidIban, normaliseIban, spayd } from "./spayd";

const iban = "CZ6508000000192000145399";

describe("isValidIban", () => {
  it("accepts a well-formed Czech IBAN", () => {
    expect(isValidIban(iban)).toBe(true);
    expect(isValidIban("cz65 0800 0000 1920 0014 5399")).toBe(true);
  });

  it("rejects a mistyped one", () => {
    expect(isValidIban("CZ6608000000192000145399")).toBe(false);
    expect(isValidIban("CZ65080000001920001453")).toBe(false);
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("not an iban")).toBe(false);
  });
});

describe("normaliseIban", () => {
  it("strips spaces and upper cases", () => {
    expect(normaliseIban(" cz65 0800 0000 1920 0014 5399 ")).toBe(iban);
  });
});

describe("spayd", () => {
  it("builds the string a Czech banking app expects", () => {
    expect(spayd({ iban, amountMinor: fromKc(480.55), variableSymbol: "1234567890" })).toBe(
      `SPD*1.0*ACC:${iban}*AM:480.55*CC:CZK*X-VS:1234567890`,
    );
  });

  it("always writes two decimals with a dot, never a Czech comma", () => {
    expect(spayd({ iban, amountMinor: fromKc(1200), variableSymbol: "1" })).toContain("AM:1200.00");
    expect(spayd({ iban, amountMinor: fromKc(0.5), variableSymbol: "1" })).toContain("AM:0.50");
  });

  it("transliterates the message, because the format is ASCII only", () => {
    const result = spayd({
      iban,
      amountMinor: fromKc(10),
      variableSymbol: "7",
      message: "Platba za zboží č. 5",
    });
    expect(result).toContain("MSG:Platba za zbozi c. 5");
  });

  it("removes the format's own separators from the message", () => {
    const result = spayd({ iban, amountMinor: fromKc(10), variableSymbol: "7", message: "a*b:c" });
    expect(result.endsWith("MSG:a b c")).toBe(true);
  });

  it("caps the message at 60 characters", () => {
    const result = spayd({ iban, amountMinor: fromKc(10), variableSymbol: "7", message: "x".repeat(100) });
    expect(result.split("MSG:")[1]).toHaveLength(60);
  });

  it("omits an empty message rather than writing an empty field", () => {
    expect(spayd({ iban, amountMinor: fromKc(10), variableSymbol: "7", message: "  " })).not.toContain(
      "MSG:",
    );
  });

  it("refuses an invalid IBAN instead of printing an unpayable QR code", () => {
    expect(() => spayd({ iban: "CZ0000", amountMinor: fromKc(10), variableSymbol: "7" })).toThrow(/IBAN/);
  });

  it("refuses a variable symbol that is not 1 to 10 digits", () => {
    expect(() => spayd({ iban, amountMinor: fromKc(10), variableSymbol: "12345678901" })).toThrow(
      /variable symbol/,
    );
    expect(() => spayd({ iban, amountMinor: fromKc(10), variableSymbol: "abc" })).toThrow(/variable symbol/);
  });

  it("refuses a negative amount", () => {
    expect(() => spayd({ iban, amountMinor: fromKc(-1), variableSymbol: "7" })).toThrow(/negative/);
  });

  it("takes a currency other than CZK", () => {
    expect(spayd({ iban, amountMinor: fromKc(10), variableSymbol: "7", currency: "EUR" })).toContain(
      "CC:EUR",
    );
  });
});
