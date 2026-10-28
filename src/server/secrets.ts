import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Carrier credentials at rest.
 *
 * An API key that can create consignments and charge cash on delivery is not a setting,
 * it is a secret, so it is encrypted with AES-256-GCM and never leaves the server. The
 * admin shows whether a secret is set, never what it is: once stored, the only operations
 * are replace and delete.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class MissingSecretsKeyError extends Error {
  constructor() {
    super(
      "SECRETS_KEY is not set. Generate one with `node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64'))\"` and put it in .env.local.",
    );
    this.name = "MissingSecretsKeyError";
  }
}

function key(): Buffer {
  const raw = process.env["SECRETS_KEY"];
  if (raw === undefined || raw === "") throw new MissingSecretsKeyError();

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== KEY_BYTES) {
    throw new Error(`SECRETS_KEY must be ${KEY_BYTES} bytes of base64, got ${decoded.length}`);
  }
  return decoded;
}

export function hasSecretsKey(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** Returns `iv.ciphertext.tag`, all base64url, so it is safe in JSON and in a URL. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 3) throw new Error("secret envelope is malformed");

  const [iv, ciphertext, tag] = parts.map((part) => Buffer.from(part, "base64url"));
  if (iv === undefined || ciphertext === undefined || tag === undefined) {
    throw new Error("secret envelope is malformed");
  }

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
