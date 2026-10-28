import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Who may use the admin.
 *
 * The real mechanism is Supabase Auth with roles in `staff_members`, per the schema. That
 * needs a Supabase project, which does not exist yet, so there is a second path: a local
 * login with one owner account from the environment.
 *
 * The local path is opt-in through `ADMIN_LOCAL_LOGIN=1` rather than inferred from
 * NODE_ENV. Inferring it is how a development login ends up live: a build that forgets to
 * set NODE_ENV, a preview deploy, a container that defaults to development. Opting in
 * means a deployment that does not set the variable cannot use it at all, whatever else
 * is misconfigured.
 */

const COOKIE = "ed_admin";
const SESSION_HOURS = 8;

export type StaffRole = "owner" | "admin" | "eshop_manager" | "salesperson" | "readonly";

export interface Session {
  readonly email: string;
  readonly role: StaffRole;
  readonly expiresAt: number;
}

export class MissingSessionSecretError extends Error {
  constructor() {
    super("ADMIN_SESSION_SECRET is not set. Put a long random value in .env.local.");
    this.name = "MissingSessionSecretError";
  }
}

function secret(): Buffer {
  const raw = process.env["ADMIN_SESSION_SECRET"];
  if (raw === undefined || raw.length < 32) throw new MissingSessionSecretError();
  return Buffer.from(raw, "utf8");
}

export function localLoginEnabled(): boolean {
  return process.env["ADMIN_LOCAL_LOGIN"] === "1";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, so compare lengths separately and keep
  // the comparison itself constant time.
  return left.length === right.length && timingSafeEqual(left, right);
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): Session | null {
  const [payload, signature] = token.split(".");
  if (payload === undefined || signature === undefined) return null;
  if (!equal(signature, sign(payload))) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const shape = parsed as Partial<Session>;
    if (
      typeof shape.email !== "string" ||
      typeof shape.role !== "string" ||
      typeof shape.expiresAt !== "number"
    ) {
      return null;
    }
    if (shape.expiresAt < Date.now()) return null;
    return { email: shape.email, role: shape.role as StaffRole, expiresAt: shape.expiresAt };
  } catch {
    return null;
  }
}

export async function currentSession(): Promise<Session | null> {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    return token === undefined ? null : decode(token);
  } catch {
    // No secret configured means nobody is signed in, rather than a crashed admin.
    return null;
  }
}

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!localLoginEnabled()) {
    return {
      ok: false,
      error:
        "Přihlášení zatím není nastavené. Připojte Supabase, nebo pro místní práci nastavte ADMIN_LOCAL_LOGIN=1.",
    };
  }

  const expectedEmail = process.env["ADMIN_EMAIL"] ?? "";
  const expectedPassword = process.env["ADMIN_PASSWORD"] ?? "";
  if (expectedEmail === "" || expectedPassword === "") {
    return { ok: false, error: "ADMIN_EMAIL a ADMIN_PASSWORD nejsou nastavené." };
  }

  // Both compared, both constant time, so neither tells the caller which one was wrong.
  const emailOk = equal(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordOk = equal(password, expectedPassword);
  if (!emailOk || !passwordOk) {
    return { ok: false, error: "Nesprávný e-mail nebo heslo." };
  }

  const session: Session = {
    email: expectedEmail,
    role: "owner",
    expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };

  (await cookies()).set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });

  return { ok: true };
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Roles allowed to change carrier settings. */
export function canManageShipping(role: StaffRole): boolean {
  return role === "owner" || role === "admin" || role === "eshop_manager";
}

/** Convenience for generating the two secrets the admin needs. */
export function suggestSecret(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}
