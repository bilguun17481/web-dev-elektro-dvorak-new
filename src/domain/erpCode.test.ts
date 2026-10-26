import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyErpCode, needsCodeReview, normaliseErpCode, splitCodeField } from "./erpCode";

describe("normaliseErpCode", () => {
  it("upper cases and drops diacritics", () => {
    expect(normaliseErpCode("žA246056R")).toBe("ZA246056R");
    expect(normaliseErpCode("lpdr040BK")).toBe("LPDR040BK");
  });

  it("drops inner whitespace, because one code appears both spaced and unspaced", () => {
    expect(normaliseErpCode("A10 30 00")).toBe("A103000");
    expect(normaliseErpCode("M 10 60 00")).toBe("M106000");
    expect(normaliseErpCode("M 10 60 00")).toBe(normaliseErpCode("M10 60 00"));
  });

  it("keeps punctuation that is part of the code", () => {
    expect(normaliseErpCode("EP-BAG/micro")).toBe("EP-BAG/MICRO");
    expect(normaliseErpCode("DX-SMD5050-RGB/1,5M")).toBe("DX-SMD5050-RGB/1,5M");
  });
});

describe("splitCodeField", () => {
  it("splits two codes separated by a spaced slash", () => {
    expect(splitCodeField("19078060 / A12241")).toEqual(["19078060", "A12241"]);
    expect(splitCodeField("28720551 / A20298")).toEqual(["28720551", "A20298"]);
  });

  it("splits two codes separated by a space", () => {
    expect(splitCodeField("EA3004 EA30031")).toEqual(["EA3004", "EA30031"]);
  });

  it("does not split a slash that is part of one code", () => {
    expect(splitCodeField("20/4 TURBO")).toEqual(["20/4TURBO"]);
    expect(splitCodeField("EP-BAG/micro")).toEqual(["EP-BAG/MICRO"]);
  });

  it("does not split a brand from its model, which has no digit of its own", () => {
    expect(splitCodeField("Lord L1 2.GN")).toEqual(["LORDL12.GN"]);
    expect(splitCodeField("Lord C24")).toEqual(["LORDC24"]);
    expect(splitCodeField("GLOX T3")).toEqual(["GLOXT3"]);
  });

  it("does not split a code whose groups are digits", () => {
    expect(splitCodeField("A10 30 00")).toEqual(["A103000"]);
    expect(splitCodeField("1120 640 2005")).toEqual(["11206402005"]);
    expect(splitCodeField("BT 16024N")).toEqual(["BT16024N"]);
  });
});

describe("classifyErpCode", () => {
  it("reads a plain code", () => {
    expect(classifyErpCode("HYUWS2244B")).toEqual({ kind: "code", normalised: "HYUWS2244B", alternates: [] });
  });

  it("carries the second code as an alternate to match on", () => {
    expect(classifyErpCode("19078060 / A12241")).toEqual({
      kind: "code",
      normalised: "19078060",
      alternates: ["A12241"],
    });
  });

  it("recognises a KAT placeholder as no code at all", () => {
    expect(classifyErpCode("KAT6913")).toMatchObject({ kind: "placeholder" });
    expect(classifyErpCode("KAT201647")).toMatchObject({ kind: "placeholder" });
  });

  it("recognises an empty field and a bare dash", () => {
    expect(classifyErpCode("")).toMatchObject({ kind: "placeholder" });
    expect(classifyErpCode("-")).toMatchObject({ kind: "placeholder" });
  });

  it("blocks the row a member of staff marked as not for the web", () => {
    expect(classifyErpCode("NESMÍ NA WEB!!!!")).toEqual({
      kind: "blocked",
      reason: "marked in the ERP as not for the web",
    });
  });

  it("keeps a letters-only code, because most of them are real", () => {
    expect(classifyErpCode("GOGDRZAKTILTL")).toMatchObject({ kind: "code", normalised: "GOGDRZAKTILTL" });
    expect(classifyErpCode("ELPNEPTUN")).toMatchObject({ kind: "code" });
  });

  it("flags a letters-only code for review without discarding it", () => {
    expect(needsCodeReview("halapaš")).toBe(true);
    expect(needsCodeReview("GOGDRZAKTILTL")).toBe(true);
    expect(needsCodeReview("HYUWS2244B")).toBe(false);
  });
});

/**
 * The rules above are derived from the real export, so they are asserted against it.
 * If the scraper is re-run and the shape of the data changes, this fails rather than
 * letting a silent drift through into the import.
 */
describe("against the real export", () => {
  const csv = readFileSync(fileURLToPath(new URL("../../data/export/url_map.csv", import.meta.url)), "utf8");

  const rows = csv
    .trim()
    .split("\n")
    .slice(1)
    .map((row) => {
      const fields: string[] = [];
      let field = "";
      let quoted = false;
      for (const char of row) {
        if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) {
          fields.push(field);
          field = "";
        } else field += char;
      }
      fields.push(field);
      return { id: fields[2] ?? "", code: fields[3] ?? "" };
    });

  it("parses every row", () => {
    expect(rows).toHaveLength(11_196);
  });

  it("classifies exactly 62 rows as having no usable code", () => {
    const verdicts = rows.map((row) => classifyErpCode(row.code));
    const placeholders = verdicts.filter((v) => v.kind === "placeholder");
    const blocked = verdicts.filter((v) => v.kind === "blocked");

    expect(placeholders).toHaveLength(61);
    expect(blocked).toHaveLength(1);
    expect(placeholders.length + blocked.length).toBe(62);
    expect(verdicts.filter((v) => v.kind === "code")).toHaveLength(11_134);
  });

  it("normalises losslessly: no two differently spelled codes collapse onto one", () => {
    const byNormalised = new Map<string, Set<string>>();
    for (const row of rows) {
      if (classifyErpCode(row.code).kind !== "code") continue;
      const normalised = normaliseErpCode(row.code);
      const seen = byNormalised.get(normalised) ?? new Set<string>();
      seen.add(row.code.trim());
      byNormalised.set(normalised, seen);
    }
    const collisions = [...byNormalised.entries()].filter(([, raw]) => raw.size > 1);
    expect(collisions).toEqual([]);
  });

  it("only ever reduces a multi-code field to a primary that is itself a code", () => {
    // `EA3004 EA30031` reduces to `EA3004`, which another row also carries. That is the
    // known duplicate-card problem in the data, not a defect in normalisation, so the
    // guard here is the weaker one: a primary must never come out without a digit,
    // which is what the brand-plus-model fields used to do.
    for (const row of rows) {
      const verdict = classifyErpCode(row.code);
      if (verdict.kind !== "code" || verdict.alternates.length === 0) continue;
      expect(verdict.normalised).toMatch(/\d/);
    }
  });

  it("leaves 27 letters-only codes for a human to confirm", () => {
    expect(rows.filter((row) => needsCodeReview(row.code))).toHaveLength(27);
  });
});
