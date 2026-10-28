import { describe, expect, it } from "vitest";
import { fromHaler } from "@/domain/money";
import { manualProvider, resolveManualTrackingUrl } from "./manual";

describe("manual carrier", () => {
  it("accepts a connection once it has a name, with no API to call", async () => {
    const result = await manualProvider.testConnection({ credentials: { carrierLabel: "FOFR" } });
    expect(result).toEqual({ ok: true, value: { account: "FOFR" } });
  });

  it("refuses an unnamed one", async () => {
    const result = await manualProvider.testConnection({ credentials: {} });
    expect(result.ok).toBe(false);
  });

  it("says plainly that it cannot create a shipment, rather than failing obscurely", async () => {
    const result = await manualProvider.createShipment(
      { credentials: { carrierLabel: "FOFR" } },
      {
        orderNumber: "2026000001",
        carrierCode: "manual",
        serviceCode: null,
        recipient: {
          name: "Jan Novák",
          street: "Nádražní 1",
          city: "Čáslav",
          zip: "28601",
          country: "CZ",
          email: "jan@example.cz",
          phone: "+420123456789",
        },
        pickupPointId: null,
        weightKg: 40,
        codMinor: fromHaler(0),
        valueMinor: fromHaler(1_200_000),
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("API");
  });
});

describe("resolveManualTrackingUrl", () => {
  it("fills the number into the template", () => {
    expect(resolveManualTrackingUrl("https://www.fofr.cz/sledovani/?cislo={tracking}", "123456")).toBe(
      "https://www.fofr.cz/sledovani/?cislo=123456",
    );
  });

  it("escapes the number, so a number with a slash cannot change the URL", () => {
    expect(resolveManualTrackingUrl("https://x.cz/?c={tracking}", "a/b?c=d")).toBe(
      "https://x.cz/?c=a%2Fb%3Fc%3Dd",
    );
  });

  it("returns null when there is no template or no placeholder in it", () => {
    expect(resolveManualTrackingUrl(undefined, "1")).toBeNull();
    expect(resolveManualTrackingUrl("", "1")).toBeNull();
    expect(resolveManualTrackingUrl("https://x.cz/sledovani", "1")).toBeNull();
  });
});
