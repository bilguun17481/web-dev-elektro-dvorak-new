import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hasSecretsKey } from "./secrets";

const KEY = Buffer.alloc(32, 7).toString("base64");

beforeEach(() => {
  process.env["SECRETS_KEY"] = KEY;
});

describe("secrets", () => {
  it("round-trips a credential", () => {
    expect(decryptSecret(encryptSecret("api-key-123"))).toBe("api-key-123");
  });

  it("produces a different envelope every time, so equal keys are not recognisable", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("refuses an envelope that has been tampered with", () => {
    const envelope = encryptSecret("api-key-123");
    const [iv, ciphertext, tag] = envelope.split(".");
    const flipped = Buffer.from(ciphertext ?? "", "base64url");
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() => decryptSecret(`${iv}.${flipped.toString("base64url")}.${tag}`)).toThrow();
  });

  it("refuses a malformed envelope rather than returning something", () => {
    expect(() => decryptSecret("nonsense")).toThrow(/malformed/);
  });

  it("refuses to decrypt with the wrong key", () => {
    const envelope = encryptSecret("api-key-123");
    process.env["SECRETS_KEY"] = Buffer.alloc(32, 9).toString("base64");
    expect(() => decryptSecret(envelope)).toThrow();
  });

  it("reports a missing or wrong-sized key instead of encrypting with a weak one", () => {
    delete process.env["SECRETS_KEY"];
    expect(hasSecretsKey()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(/SECRETS_KEY/);

    process.env["SECRETS_KEY"] = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });
});
