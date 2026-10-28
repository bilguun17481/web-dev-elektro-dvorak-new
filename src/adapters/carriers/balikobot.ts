/**
 * Balíkobot, an aggregator that fronts most Czech carriers (PPL, DPD, Zásilkovna, Česká
 * pošta, GLS and others). Connecting it once makes every carrier on the account
 * available, which is why it is the first provider: adding a carrier afterwards is a
 * dropdown in the admin, not a code change.
 *
 * What is verified and what is not, as of writing:
 *
 * Verified from the reference PHP client (inspirum/balikobot-php), which tracks the
 * official v2 documentation: authentication is HTTP Basic with an API user and an API
 * key, and the method names are `add`, `drop`, `track`, `trackstatus`, `overview`,
 * `labels`, `order`, `services`, `fullbranches`, `info/whoami` and `info/carriers`.
 *
 * NOT verified: the base URL, the version segment and the field names of the `add`
 * payload. balikobot.cz is blocked by this environment's network policy, so the official
 * handbook could not be read. The base URL and version are therefore admin fields rather
 * than constants, and `createShipment` is marked below as needing a check against the
 * account's own documentation before it is used in anger. `testConnection` and
 * `listCarriers` use only the parts that are verified, which is what the admin exercises.
 */

import type {
  CarrierProvider,
  ConnectionContext,
  ProviderDefinition,
  ProviderResult,
  Shipment,
  ShipmentRequest,
  TrackingEvent,
} from "./types";

const DEFAULT_BASE_URL = "https://api.balikobot.cz";
const DEFAULT_VERSION = "v2";
const TIMEOUT_MS = 15_000;

export const balikobotDefinition: ProviderDefinition = {
  id: "balikobot",
  label: "Balíkobot",
  docsUrl: "https://www.balikobot.cz/implementatorska-prirucka",
  description:
    "Agregátor dopravců. Jedno připojení zpřístupní všechny dopravce, které máte na účtu Balíkobotu aktivované.",
  credentials: [
    {
      key: "apiUser",
      label: "API uživatel",
      kind: "text",
      required: true,
      help: "Z klientské zóny Balíkobotu.",
    },
    {
      key: "apiKey",
      label: "API klíč",
      kind: "secret",
      required: true,
      help: "Uloží se zašifrovaně a už se nikdy nezobrazí.",
    },
    {
      key: "baseUrl",
      label: "Adresa API",
      kind: "url",
      required: false,
      defaultValue: DEFAULT_BASE_URL,
      placeholder: DEFAULT_BASE_URL,
      help: "Ověřte v dokumentaci svého účtu. Změníte zde, bez zásahu do kódu.",
    },
    {
      key: "version",
      label: "Verze API",
      kind: "text",
      required: false,
      defaultValue: DEFAULT_VERSION,
      placeholder: DEFAULT_VERSION,
      help: "Balíkobot doporučuje v2.",
    },
  ],
  capabilities: {
    shipments: true,
    labels: true,
    tracking: true,
    pickupPoints: true,
    testConnection: true,
  },
  // Shown before a connection has been tested; the real list comes from info/carriers.
  knownCarriers: [
    { code: "cp", label: "Česká pošta" },
    { code: "ppl", label: "PPL" },
    { code: "dpd", label: "DPD" },
    { code: "gls", label: "GLS" },
    { code: "zasilkovna", label: "Zásilkovna" },
    { code: "toptrans", label: "TOPTRANS" },
    { code: "geis", label: "Geis" },
    { code: "sps", label: "SPS" },
  ],
};

function settings(context: ConnectionContext) {
  const baseUrl = (context.credentials["baseUrl"] ?? "").trim() || DEFAULT_BASE_URL;
  const version = (context.credentials["version"] ?? "").trim() || DEFAULT_VERSION;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), version };
}

function authHeader(context: ConnectionContext): string {
  const user = context.credentials["apiUser"] ?? "";
  const key = context.credentials["apiKey"] ?? "";
  return `Basic ${Buffer.from(`${user}:${key}`).toString("base64")}`;
}

/** `{base}/{version}/{carrier}/{method}`, or without the carrier for the info methods. */
function endpoint(context: ConnectionContext, method: string, carrierCode?: string): string {
  const { baseUrl, version } = settings(context);
  return carrierCode === undefined
    ? `${baseUrl}/${version}/${method}`
    : `${baseUrl}/${version}/${carrierCode}/${method}`;
}

async function call(
  context: ConnectionContext,
  method: string,
  options: { carrierCode?: string; body?: unknown } = {},
): Promise<ProviderResult<unknown>> {
  const url = endpoint(context, method, options.carrierCode);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.body === undefined ? "GET" : "POST",
      headers: {
        Authorization: authHeader(context),
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      // The status and a short excerpt only. The body can echo the request, and the
      // request carries the recipient's address.
      return {
        ok: false,
        error: `Balíkobot odpověděl ${response.status}`,
        detail: text.slice(0, 300),
      };
    }

    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false, error: "Odpověď nebyla ve formátu JSON", detail: text.slice(0, 300) };
    }
  } catch (cause) {
    const reason =
      cause instanceof Error && cause.name === "AbortError" ? "vypršel časový limit" : "spojení selhalo";
    return { ok: false, error: `Balíkobot je nedostupný: ${reason}`, detail: url };
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export const balikobotProvider: CarrierProvider = {
  definition: balikobotDefinition,

  async testConnection(context) {
    const result = await call(context, "info/whoami");
    if (!result.ok) return result;

    const body = asRecord(result.value);
    const account =
      typeof body["name"] === "string"
        ? body["name"]
        : typeof body["account"] === "string"
          ? body["account"]
          : (context.credentials["apiUser"] ?? "");
    return { ok: true, value: { account } };
  },

  async listCarriers(context) {
    const result = await call(context, "info/carriers");
    if (!result.ok) return result;

    const body = asRecord(result.value);
    const carriers = asRecord(body["carriers"] ?? body);
    const listed = Object.entries(carriers).flatMap(([code, value]) => {
      if (code === "status") return [];
      const label = typeof value === "string" ? value : (asRecord(value)["name"] ?? code);
      return [{ code, label: typeof label === "string" ? label : code }];
    });

    return { ok: true, value: listed.length > 0 ? listed : [...balikobotDefinition.knownCarriers] };
  },

  /**
   * NOT verified against the official documentation: the payload field names below follow
   * the reference clients, but balikobot.cz could not be reached from this environment.
   * Check them against the v2 docs for your account before the first live consignment.
   */
  async createShipment(context, request: ShipmentRequest): Promise<ProviderResult<Shipment>> {
    const payload = {
      packages: [
        {
          eid: request.orderNumber,
          service_type: request.serviceCode,
          branch_id: request.pickupPointId,
          rec_name: request.recipient.name,
          rec_street: request.recipient.street,
          rec_city: request.recipient.city,
          rec_zip: request.recipient.zip,
          rec_country: request.recipient.country,
          rec_email: request.recipient.email,
          rec_phone: request.recipient.phone,
          cod_price: request.codMinor === 0 ? undefined : request.codMinor / 100,
          cod_currency: request.codMinor === 0 ? undefined : "CZK",
          price: request.valueMinor / 100,
          weight: request.weightKg ?? undefined,
        },
      ],
    };

    const result = await call(context, "add", { carrierCode: request.carrierCode, body: payload });
    if (!result.ok) return result;

    const body = asRecord(result.value);
    const packages = Array.isArray(body["packages"]) ? body["packages"] : [];
    const first = asRecord(packages[0]);
    const trackingNumber = typeof first["carrier_id"] === "string" ? first["carrier_id"] : "";

    if (trackingNumber === "") {
      return {
        ok: false,
        error: "Balíkobot nevrátil číslo zásilky",
        detail: JSON.stringify(body).slice(0, 300),
      };
    }

    return {
      ok: true,
      value: {
        trackingNumber,
        carrierCode: request.carrierCode,
        labelUrl: typeof first["label_url"] === "string" ? first["label_url"] : null,
        providerRef: typeof first["package_id"] === "string" ? first["package_id"] : null,
      },
    };
  },

  async track(context, trackingNumber, carrierCode) {
    const result = await call(context, "track", {
      carrierCode,
      body: { carrier_ids: [trackingNumber] },
    });
    if (!result.ok) return result;

    const body = asRecord(result.value);
    const packages = Array.isArray(body["packages"]) ? body["packages"] : [];
    const states = Array.isArray(packages[0]) ? packages[0] : [];

    const events = states.flatMap((state): TrackingEvent[] => {
      const row = asRecord(state);
      return [
        {
          at: typeof row["date"] === "string" ? row["date"] : "",
          status: String(row["status_id"] ?? ""),
          description: typeof row["name"] === "string" ? row["name"] : "",
        },
      ];
    });

    return { ok: true, value: events };
  },

  trackingUrl(trackingNumber, carrierCode) {
    // Balíkobot returns a tracklink per package; this is the fallback for a number typed
    // in by hand, where the carrier's own page is the only thing to point at.
    const byCarrier: Record<string, string> = {
      cp: `https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=${encodeURIComponent(trackingNumber)}`,
      ppl: `https://www.ppl.cz/vyhledat-zasilku?shipmentId=${encodeURIComponent(trackingNumber)}`,
      dpd: `https://www.dpd.com/cz/cs/sledovani/?parcelNumber=${encodeURIComponent(trackingNumber)}`,
      gls: `https://gls-group.eu/CZ/cs/sledovani-zasilek?match=${encodeURIComponent(trackingNumber)}`,
      zasilkovna: `https://tracking.packeta.com/cs/?id=${encodeURIComponent(trackingNumber)}`,
    };
    return byCarrier[carrierCode] ?? null;
  },
};
