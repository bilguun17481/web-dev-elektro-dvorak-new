/**
 * Carrier integrations.
 *
 * The split that makes a carrier addable from the admin: *what a provider can do* is
 * code, *which providers are connected and how they are priced* is data. A provider
 * describes its own credential fields, so the admin renders a form for a provider it has
 * never heard of without a line of UI being written for it.
 *
 * Nothing above this directory knows whether a label comes from Balíkobot, from a
 * carrier's own API, or from a person pasting a number off a portal.
 */

import type { Minor } from "@/domain/money";

/** One field a provider needs before it can be used. Rendered by the admin as a form. */
export interface CredentialField {
  readonly key: string;
  readonly label: string;
  /** `secret` is write-only: it is never sent back to the browser once stored. */
  readonly kind: "text" | "secret" | "url";
  readonly required: boolean;
  readonly help?: string;
  readonly placeholder?: string;
  readonly defaultValue?: string;
}

export interface ProviderCapabilities {
  /** The provider can create a shipment and return a tracking number. */
  readonly shipments: boolean;
  /** The provider returns a printable label. */
  readonly labels: boolean;
  /** The provider can report tracking status. */
  readonly tracking: boolean;
  /** The provider offers pickup points the customer chooses from. */
  readonly pickupPoints: boolean;
  /** The provider can confirm the credentials are valid without creating anything. */
  readonly testConnection: boolean;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly label: string;
  /** Shown in the admin so whoever is configuring it can read the provider's own docs. */
  readonly docsUrl: string | null;
  readonly description: string;
  readonly credentials: readonly CredentialField[];
  readonly capabilities: ProviderCapabilities;
  /**
   * Carrier codes this provider can ship with, when it fronts several. Empty means the
   * provider is the carrier. Balíkobot returns its own list from the API, so this is only
   * the fallback shown before a connection has been tested.
   */
  readonly knownCarriers: readonly { code: string; label: string }[];
}

export interface ShipmentRequest {
  readonly orderNumber: string;
  readonly carrierCode: string;
  readonly serviceCode: string | null;
  readonly recipient: {
    readonly name: string;
    readonly street: string;
    readonly city: string;
    readonly zip: string;
    readonly country: string;
    readonly email: string;
    readonly phone: string;
  };
  readonly pickupPointId: string | null;
  readonly weightKg: number | null;
  readonly codMinor: Minor;
  readonly valueMinor: Minor;
}

export interface Shipment {
  readonly trackingNumber: string;
  readonly carrierCode: string;
  readonly labelUrl: string | null;
  readonly providerRef: string | null;
}

export interface TrackingEvent {
  readonly at: string;
  readonly status: string;
  readonly description: string;
}

/**
 * Result rather than throw: a carrier being misconfigured or refusing a consignment is an
 * expected outcome that the admin has to show, not a bug.
 */
export type ProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

export interface ConnectionContext {
  /** Decrypted credentials, keyed as the provider declared them. */
  readonly credentials: Readonly<Record<string, string>>;
}

export interface CarrierProvider {
  readonly definition: ProviderDefinition;
  /** Confirms the credentials without creating anything. */
  testConnection(context: ConnectionContext): Promise<ProviderResult<{ account: string }>>;
  /** Carriers this connection is actually allowed to use, asked of the provider. */
  listCarriers(context: ConnectionContext): Promise<ProviderResult<{ code: string; label: string }[]>>;
  createShipment(context: ConnectionContext, request: ShipmentRequest): Promise<ProviderResult<Shipment>>;
  track(
    context: ConnectionContext,
    trackingNumber: string,
    carrierCode: string,
  ): Promise<ProviderResult<TrackingEvent[]>>;
  trackingUrl(trackingNumber: string, carrierCode: string): string | null;
}
