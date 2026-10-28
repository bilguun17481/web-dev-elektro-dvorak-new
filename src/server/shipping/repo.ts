import { randomUUID } from "node:crypto";
import { providerById } from "@/adapters/carriers/registry";
import type { ConnectionContext, ProviderResult } from "@/adapters/carriers/types";
import { decryptSecret, encryptSecret } from "@/server/secrets";
import { getStore } from "@/server/store";
import type { StoredCarrierConnection, StoredPricing, StoredShippingMethod } from "./config";
import { defaultPricing } from "./config";

/**
 * Reading and writing carrier connections and shipping methods.
 *
 * Secrets go in encrypted and come out decrypted only here, on the way to a provider
 * call. Anything bound for the browser goes through `redactConnection` first.
 */

/** What the admin is allowed to see: everything except the secrets themselves. */
export interface SafeConnection extends Omit<StoredCarrierConnection, "credentials" | "secretKeys"> {
  readonly credentials: Readonly<Record<string, string>>;
  readonly secretsSet: readonly string[];
}

export function redactConnection(connection: StoredCarrierConnection): SafeConnection {
  const { credentials, secretKeys, ...rest } = connection;
  const visible = Object.fromEntries(
    Object.entries(credentials).filter(([key]) => !secretKeys.includes(key)),
  );
  const secretsSet = secretKeys.filter((key) => (credentials[key] ?? "") !== "");
  return { ...rest, credentials: visible, secretsSet };
}

export async function listConnections(): Promise<SafeConnection[]> {
  const data = await getStore().read();
  return data.connections.map(redactConnection);
}

export async function listMethods(): Promise<StoredShippingMethod[]> {
  const data = await getStore().read();
  return [...data.methods].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "cs"));
}

/** Decrypts a connection's secrets for a provider call. Never returned to a caller above. */
async function contextFor(connectionId: string): Promise<ConnectionContext | null> {
  const data = await getStore().read();
  const connection = data.connections.find((row) => row.id === connectionId);
  if (connection === undefined) return null;

  const credentials = Object.fromEntries(
    Object.entries(connection.credentials).map(([key, value]) => [
      key,
      connection.secretKeys.includes(key) && value !== "" ? decryptSecret(value) : value,
    ]),
  );
  return { credentials };
}

export interface SaveConnectionInput {
  readonly id: string | null;
  readonly providerId: string;
  readonly label: string;
  readonly enabled: boolean;
  /** Only the fields that were filled in. A blank secret leaves the stored one alone. */
  readonly credentials: Readonly<Record<string, string>>;
}

export async function saveConnection(input: SaveConnectionInput): Promise<ProviderResult<SafeConnection>> {
  const provider = providerById(input.providerId);
  if (provider === null) return { ok: false, error: `Neznámý poskytovatel ${input.providerId}` };

  const fields = provider.definition.credentials;
  const secretKeys = fields.filter((field) => field.kind === "secret").map((field) => field.key);

  const missing = fields.filter(
    (field) =>
      field.required && field.kind !== "secret" && (input.credentials[field.key] ?? "").trim() === "",
  );
  if (missing.length > 0) {
    return { ok: false, error: `Vyplňte: ${missing.map((field) => field.label).join(", ")}` };
  }

  const data = await getStore().read();
  const existing = input.id === null ? undefined : data.connections.find((row) => row.id === input.id);

  // A required secret has to be present on create; on edit, a blank field means "keep".
  const missingSecret = fields.filter(
    (field) =>
      field.required &&
      field.kind === "secret" &&
      (input.credentials[field.key] ?? "").trim() === "" &&
      (existing?.credentials[field.key] ?? "") === "",
  );
  if (missingSecret.length > 0) {
    return { ok: false, error: `Vyplňte: ${missingSecret.map((field) => field.label).join(", ")}` };
  }

  const credentials: Record<string, string> = { ...(existing?.credentials ?? {}) };
  for (const field of fields) {
    const entered = (input.credentials[field.key] ?? "").trim();
    if (field.kind === "secret") {
      if (entered !== "") credentials[field.key] = encryptSecret(entered);
      continue;
    }
    credentials[field.key] = entered === "" ? (field.defaultValue ?? "") : entered;
  }

  const connection: StoredCarrierConnection = {
    id: existing?.id ?? randomUUID(),
    providerId: input.providerId,
    label: input.label.trim() === "" ? provider.definition.label : input.label.trim(),
    enabled: input.enabled,
    credentials,
    secretKeys,
    carriers: existing?.carriers ?? [],
    lastTestedAt: existing?.lastTestedAt ?? null,
    lastTestOk: existing?.lastTestOk ?? null,
    lastTestMessage: existing?.lastTestMessage ?? null,
  };

  await getStore().update((current) => ({
    ...current,
    connections:
      existing === undefined
        ? [...current.connections, connection]
        : current.connections.map((row) => (row.id === connection.id ? connection : row)),
  }));

  return { ok: true, value: redactConnection(connection) };
}

export async function deleteConnection(id: string): Promise<void> {
  await getStore().update((current) => ({
    connections: current.connections.filter((row) => row.id !== id),
    // A method without its connection cannot ship, so it goes with it.
    methods: current.methods.filter((row) => row.connectionId !== id),
  }));
}

/** Calls the provider's own check and records the verdict against the connection. */
export async function testConnection(id: string): Promise<ProviderResult<{ account: string }>> {
  const data = await getStore().read();
  const connection = data.connections.find((row) => row.id === id);
  if (connection === undefined) return { ok: false, error: "Připojení neexistuje" };

  const provider = providerById(connection.providerId);
  const context = await contextFor(id);
  if (provider === null || context === null) return { ok: false, error: "Připojení nelze načíst" };

  const result = await provider.testConnection(context);

  // A successful test is also the moment to refresh the carrier list. Doing it here keeps
  // the provider off the request path of every admin page render, where an unreachable
  // host would stall the page for the length of the timeout.
  const carriers = result.ok ? await provider.listCarriers(context) : null;

  await getStore().update((current) => ({
    ...current,
    connections: current.connections.map((row) =>
      row.id === id
        ? {
            ...row,
            carriers: carriers !== null && carriers.ok ? carriers.value : row.carriers,
            lastTestedAt: new Date().toISOString(),
            lastTestOk: result.ok,
            lastTestMessage: result.ok ? `Připojeno jako ${result.value.account}` : result.error,
          }
        : row,
    ),
  }));

  return result;
}

/**
 * The carriers a connection may ship with: what the last test reported, falling back to
 * what the provider ships as known. Never a live call, so a page render cannot block on
 * a carrier's API being up.
 */
export function carriersFor(connection: SafeConnection): { code: string; label: string }[] {
  const provider = providerById(connection.providerId);
  const known = provider === null ? [] : provider.definition.knownCarriers;
  const merged = new Map<string, string>();
  for (const carrier of [...known, ...connection.carriers]) merged.set(carrier.code, carrier.label);
  return [...merged].map(([code, label]) => ({ code, label }));
}

export interface SaveMethodInput {
  readonly id: string | null;
  readonly connectionId: string;
  readonly carrierCode: string;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly sort: number;
  readonly vatRateBp: number;
  readonly needsPickupPoint: boolean;
  readonly allowsBulky: boolean;
  readonly pricing: StoredPricing;
}

export async function saveMethod(input: SaveMethodInput): Promise<ProviderResult<StoredShippingMethod>> {
  const data = await getStore().read();
  if (!data.connections.some((row) => row.id === input.connectionId)) {
    return { ok: false, error: "Vyberte připojení dopravce" };
  }
  if (input.name.trim() === "") return { ok: false, error: "Vyplňte název, zákazník ho uvidí v košíku" };

  const existing = input.id === null ? undefined : data.methods.find((row) => row.id === input.id);
  const method: StoredShippingMethod = {
    id: existing?.id ?? randomUUID(),
    connectionId: input.connectionId,
    carrierCode: input.carrierCode,
    name: input.name.trim(),
    description: input.description.trim(),
    enabled: input.enabled,
    sort: input.sort,
    vatRateBp: input.vatRateBp,
    needsPickupPoint: input.needsPickupPoint,
    allowsBulky: input.allowsBulky,
    pricing: input.pricing,
  };

  await getStore().update((current) => ({
    ...current,
    methods:
      existing === undefined
        ? [...current.methods, method]
        : current.methods.map((row) => (row.id === method.id ? method : row)),
  }));

  return { ok: true, value: method };
}

export async function deleteMethod(id: string): Promise<void> {
  await getStore().update((current) => ({
    ...current,
    methods: current.methods.filter((row) => row.id !== id),
  }));
}

export { defaultPricing };
