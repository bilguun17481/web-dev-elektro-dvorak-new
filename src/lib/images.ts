import categoryImages from "@/data/categoryImages.json";
import productImages from "@/data/images.json";

/**
 * Photography lives in `public/` for now. The architecture puts it in R2 as WebP at four
 * widths; until that pipeline exists these manifests keep the lookup in one place so the
 * swap is a change here rather than in every component.
 */
const products: Record<string, string> = productImages;
const categoryTiles: Record<string, { tile?: string; wide?: string }> = categoryImages;

export function productImage(slug: string): string | null {
  return products[slug] ?? null;
}

export function categoryImage(slug: string, shape: "tile" | "wide" = "tile"): string | null {
  return categoryTiles[slug]?.[shape] ?? null;
}
