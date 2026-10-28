/**
 * Every provider the shop can connect to.
 *
 * Adding an API-backed provider is one file and one line here; everything else, including
 * the admin form, comes from the provider's own `definition`. A carrier that only needs a
 * name and a tracking link needs neither, because `manual` already covers it from the
 * admin.
 */

import { balikobotProvider } from "./balikobot";
import { manualProvider } from "./manual";
import type { CarrierProvider, ProviderDefinition } from "./types";

const providers: readonly CarrierProvider[] = [balikobotProvider, manualProvider];

const byId = new Map(providers.map((provider) => [provider.definition.id, provider]));

export function listProviders(): ProviderDefinition[] {
  return providers.map((provider) => provider.definition);
}

export function providerById(id: string): CarrierProvider | null {
  return byId.get(id) ?? null;
}

export function providerExists(id: string): boolean {
  return byId.has(id);
}
