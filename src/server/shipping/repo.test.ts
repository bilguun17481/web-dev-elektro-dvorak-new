import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ShopData, ShopStore } from "@/server/store";
import { setStore } from "@/server/store";
import { defaultPricing } from "./config";
import { deleteConnection, listConnections, listMethods, saveConnection, saveMethod } from "./repo";

function memoryStore(): ShopStore {
  let data: ShopData = { connections: [], methods: [] };
  return {
    async read() {
      return data;
    },
    async update(mutate) {
      data = mutate(data);
      return data;
    },
  };
}

let store: ShopStore;

beforeEach(() => {
  process.env["SECRETS_KEY"] = Buffer.alloc(32, 3).toString("base64");
  store = memoryStore();
  setStore(store);
});

afterEach(() => setStore(null));

const balikobot = {
  id: null,
  providerId: "balikobot",
  label: "Balíkobot",
  enabled: true,
  credentials: { apiUser: "eshop", apiKey: "super-secret", baseUrl: "", version: "" },
};

describe("saving a connection", () => {
  it("never hands the secret back, only whether one is set", async () => {
    const result = await saveConnection(balikobot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.secretsSet).toEqual(["apiKey"]);
    expect(JSON.stringify(result.value)).not.toContain("super-secret");

    const listed = await listConnections();
    expect(JSON.stringify(listed)).not.toContain("super-secret");
  });

  it("stores the secret encrypted, not as typed", async () => {
    await saveConnection(balikobot);
    const raw = JSON.stringify(await store.read());
    expect(raw).not.toContain("super-secret");
    expect(raw).toContain("apiKey");
  });

  it("falls back to the provider's default where a field was left blank", async () => {
    const result = await saveConnection(balikobot);
    if (!result.ok) throw new Error("expected save to succeed");
    expect(result.value.credentials["baseUrl"]).toBe("https://api.balikobot.cz");
    expect(result.value.credentials["version"]).toBe("v2");
  });

  it("keeps the stored secret when the field is left blank on edit", async () => {
    const created = await saveConnection(balikobot);
    if (!created.ok) throw new Error("expected save to succeed");

    const edited = await saveConnection({
      ...balikobot,
      id: created.value.id,
      label: "Balíkobot ostrý",
      credentials: { apiUser: "eshop", apiKey: "", baseUrl: "", version: "" },
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.label).toBe("Balíkobot ostrý");
    expect(edited.value.secretsSet).toEqual(["apiKey"]);
  });

  it("refuses a required secret that was never given", async () => {
    const result = await saveConnection({ ...balikobot, credentials: { apiUser: "eshop", apiKey: "" } });
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses a provider that does not exist", async () => {
    const result = await saveConnection({ ...balikobot, providerId: "made-up" });
    expect(result).toMatchObject({ ok: false });
  });

  it("accepts a manual carrier, which needs no API at all", async () => {
    const result = await saveConnection({
      id: null,
      providerId: "manual",
      label: "FOFR",
      enabled: true,
      credentials: {
        carrierLabel: "FOFR",
        trackingUrlTemplate: "https://www.fofr.cz/sledovani/?cislo={tracking}",
        portalUrl: "",
      },
    });
    expect(result.ok).toBe(true);
  });
});

describe("deleting a connection", () => {
  it("takes its shipping methods with it, so no method is left unable to ship", async () => {
    const connection = await saveConnection(balikobot);
    if (!connection.ok) throw new Error("expected save to succeed");

    await saveMethod({
      id: null,
      connectionId: connection.value.id,
      carrierCode: "ppl",
      name: "PPL na adresu",
      description: "",
      enabled: true,
      sort: 0,
      vatRateBp: 2100,
      needsPickupPoint: false,
      allowsBulky: false,
      pricing: defaultPricing("flat"),
    });
    expect(await listMethods()).toHaveLength(1);

    await deleteConnection(connection.value.id);
    expect(await listConnections()).toHaveLength(0);
    expect(await listMethods()).toHaveLength(0);
  });
});

describe("saving a method", () => {
  it("refuses a method pointing at a connection that does not exist", async () => {
    const result = await saveMethod({
      id: null,
      connectionId: "nope",
      carrierCode: "ppl",
      name: "PPL",
      description: "",
      enabled: true,
      sort: 0,
      vatRateBp: 2100,
      needsPickupPoint: false,
      allowsBulky: false,
      pricing: defaultPricing("flat"),
    });
    expect(result).toMatchObject({ ok: false });
  });
});
