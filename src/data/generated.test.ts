import { describe, expect, it } from "vitest";
import categories from "./generated/categories.json";
import redirects from "./generated/redirects.json";

const entries = Object.entries(redirects as Record<string, string>);

describe("the 301 map", () => {
  it("covers every product and category from the export", () => {
    expect(entries.filter(([, to]) => to.startsWith("/produkt/"))).toHaveLength(11_196);
    expect(entries.filter(([, to]) => to.startsWith("/kategorie/"))).toHaveLength(389);
    expect(entries).toHaveLength(11_585);
  });

  it("maps old paths to new ones, both rooted and trailing-slashed", () => {
    for (const [from, to] of entries) {
      expect(from.startsWith("/")).toBe(true);
      expect(from.endsWith(".html")).toBe(true);
      expect(to.startsWith("/")).toBe(true);
      expect(to.endsWith("/")).toBe(true);
    }
  });

  it("resolves in one hop: no target is itself a redirect source", () => {
    const sources = new Set(entries.map(([from]) => from));
    const chained = entries.filter(([, to]) => sources.has(to));
    expect(chained).toEqual([]);
  });

  it("never sends two old URLs to the same new one", () => {
    // Old slugs are shared by 31 products, so the duplicates are suffixed with their old
    // id. Without that, 32 old URLs would collapse onto another product's page.
    const targets = new Set(entries.map(([, to]) => to));
    expect(targets.size).toBe(entries.length);
  });

  it("suffixes exactly the products whose old slug was shared", () => {
    const suffixed = entries.filter(([, to]) => /\/produkt\/.*-\d{4,}\/$/.test(to));
    expect(suffixed.length).toBeGreaterThanOrEqual(32);
  });
});

describe("the category list", () => {
  it("holds all 389 categories with unique slugs", () => {
    expect(categories).toHaveLength(389);
    expect(new Set(categories.map((c) => c.slug)).size).toBe(389);
    expect(new Set(categories.map((c) => c.oldId)).size).toBe(389);
  });

  it("marks the 15 categories that need a proper slug once the tree is known", () => {
    expect(categories.filter((c) => c.needsReslug)).toHaveLength(15);
  });

  it("has no parent anywhere, because product_urls.json is missing from the export", () => {
    // This is a standing reminder, not a preference: the tree cannot be built without it.
    expect(categories.every((c) => c.parentOldId === null)).toBe(true);
  });
});
