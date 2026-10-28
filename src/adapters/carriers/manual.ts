/**
 * A carrier with no API, driven by a person.
 *
 * This is what makes "add any shipping portal from the admin" true rather than nearly
 * true. FOFR has no public shipment API and is booked in its own portal; a new regional
 * carrier may have nothing at all. Both are added here by filling in a name and a
 * tracking URL, with no code written and no deploy: staff book the consignment wherever
 * it is booked, paste the number into the order, and the customer gets a working link.
 */

import type { CarrierProvider, ProviderDefinition } from "./types";

/** The placeholder staff put in the tracking URL where the number belongs. */
const TRACKING_PLACEHOLDER = "{tracking}";

export const manualDefinition: ProviderDefinition = {
  id: "manual",
  label: "Ruční dopravce",
  docsUrl: null,
  description:
    "Dopravce bez API. Zásilku objednáte v jeho portálu, číslo zapíšete k objednávce a zákazníkovi se zobrazí odkaz na sledování.",
  credentials: [
    {
      key: "carrierLabel",
      label: "Název dopravce",
      kind: "text",
      required: true,
      placeholder: "FOFR",
      help: "Zobrazí se zákazníkovi i obsluze.",
    },
    {
      key: "trackingUrlTemplate",
      label: "Odkaz na sledování",
      kind: "url",
      required: false,
      placeholder: `https://www.fofr.cz/sledovani-zasilky/?cislo=${TRACKING_PLACEHOLDER}`,
      help: `Kam ${TRACKING_PLACEHOLDER} doplníme číslo zásilky. Nechte prázdné, pokud dopravce sledování nemá.`,
    },
    {
      key: "portalUrl",
      label: "Odkaz na portál dopravce",
      kind: "url",
      required: false,
      help: "Kam obsluha chodí zásilku objednat. Zobrazí se u objednávky.",
    },
  ],
  capabilities: {
    shipments: false,
    labels: false,
    tracking: false,
    pickupPoints: false,
    testConnection: false,
  },
  knownCarriers: [],
};

export const manualProvider: CarrierProvider = {
  definition: manualDefinition,

  async testConnection(context) {
    const label = (context.credentials["carrierLabel"] ?? "").trim();
    if (label === "") return { ok: false, error: "Vyplňte název dopravce" };
    return { ok: true, value: { account: label } };
  },

  async listCarriers(context) {
    const label = (context.credentials["carrierLabel"] ?? "").trim();
    return { ok: true, value: label === "" ? [] : [{ code: "manual", label }] };
  },

  async createShipment() {
    return {
      ok: false,
      error: "Tento dopravce nemá API",
      detail: "Objednejte zásilku v portálu dopravce a číslo zapište k objednávce.",
    };
  },

  async track() {
    return { ok: false, error: "Tento dopravce nemá sledování přes API" };
  },

  trackingUrl() {
    // The template lives on the connection, so the order page resolves it with
    // `resolveManualTrackingUrl` where it has the credentials to hand.
    return null;
  },
};

/** Fills the tracking number into a connection's template. */
export function resolveManualTrackingUrl(
  template: string | undefined,
  trackingNumber: string,
): string | null {
  const url = (template ?? "").trim();
  if (url === "" || !url.includes(TRACKING_PLACEHOLDER)) return null;
  return url.replaceAll(TRACKING_PLACEHOLDER, encodeURIComponent(trackingNumber));
}
