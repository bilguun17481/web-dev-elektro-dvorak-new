import { describe, expect, it } from "vitest";
import { products } from "@/data/catalog";
import categories from "@/data/generated/categories.json";
import { activeRedirectCount, activeTargets, redirectCount, redirectFor } from "./redirects";

describe("redirectFor", () => {
  it("resolves an old product URL onto the product's own slug", () => {
    expect(redirectFor("/jvc-lt-65vgm9435/pro519314.html")).toBe("/produkt/jvc-lt-65vgm9435/");
  });

  it("prefers the product's slug over the one derived from the old URL", () => {
    // The harvested catalogue slugged this one without the trailing "-drtic-vetvi".
    expect(redirectFor("/al-ko-easy-crush-mh-2810-drtic-vetvi/pro419039.html")).toBe(
      "/produkt/al-ko-easy-crush-mh-2810/",
    );
  });

  it("resolves an old category URL", () => {
    expect(redirectFor("/lednicky/kat32.html")).toBe("/kategorie/lednicky/");
  });

  it("tolerates a trailing slash, which crawlers and old links both produce", () => {
    expect(redirectFor("/lednicky/kat32.html/")).toBe("/kategorie/lednicky/");
  });

  it("returns null for a path of the new site, so the request passes through", () => {
    expect(redirectFor("/kategorie/lednicky/")).toBeNull();
    expect(redirectFor("/")).toBeNull();
  });

  it("does not redirect a product that has not been migrated yet", () => {
    // Serving this would be a 301 onto a 404. It starts working when the product exists.
    expect(redirectFor("/hyundai-ws-2244-cerna-barva-meteorologicka-stanice/pro5008.html")).toBeNull();
  });
});

describe("what is served", () => {
  it("holds the whole map but serves only the part that resolves", () => {
    // 389 categories and 68 of the 72 seeded products. Matching on the old id rather than
    // the old path finds one more than the path alone: id 484804 sits at
    // /susicka-romo-rhd-2071-s-s-tepelnym-cerpadlem/ in the export but was harvested from
    // /romo-rhd-2071-s-susicka-pradla-s-tepelnym-cerpadlem/, so the old site renamed its
    // slug after the scrape. The remaining 4 are newer than the scrape and are not in the
    // export at all.
    expect(redirectCount()).toBe(11_585);
    expect(activeRedirectCount()).toBe(389 + 68);
  });

  it("every served target resolves to a page that exists", () => {
    const pages = new Set([
      ...products.map((product) => `/produkt/${product.slug}/`),
      ...categories.map((category) => `/kategorie/${category.slug}/`),
    ]);
    const broken = activeTargets().filter((target) => !pages.has(target));
    expect(broken).toEqual([]);
  });

  it("serves no target that is itself a redirect source, so every hop is single", () => {
    const chained = activeTargets().filter((target) => redirectFor(target) !== null);
    expect(chained).toEqual([]);
  });
});
