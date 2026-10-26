import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import type { Category } from "@/data/catalog";
import { byCategory, categories } from "@/data/catalog";
import generatedCategories from "@/data/generated/categories.json";

/**
 * Two kinds of category live behind this route. Six are seeded with products and are the
 * ones the shop browses today. The other 383 come from the old site's 389 categories and
 * exist so that every 301 from `/<slug>/kat<id>.html` lands on a real page rather than a
 * 404 while the tree and the product mapping are still missing from the export.
 */
const seeded = new Map<string, (typeof categories)[number]>(categories.map((c) => [c.slug, c]));
const migrated = new Map<string, (typeof generatedCategories)[number]>(
  generatedCategories.map((c) => [c.slug, c]),
);

export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const seed = seeded.get(slug);
  if (seed !== undefined) return { title: seed.label.cs, description: seed.blurb.cs };

  const old = migrated.get(slug);
  return old === undefined ? {} : { title: old.name, robots: { index: false } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = seeded.get(slug);

  if (seed === undefined) {
    const old = migrated.get(slug);
    if (old === undefined) notFound();

    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold">{old.name}</h1>
        <p className="mt-4 max-w-2xl text-ink-soft">
          Tuto kategorii právě přenášíme ze starého webu. Zboží se objeví, až se spustí přenos dat ze skladu.
        </p>
      </div>
    );
  }

  const inCategory = byCategory(seed.slug as Category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold">{seed.label.cs}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">{seed.blurb.cs}</p>

      {seed.bulky && (
        <p className="mt-6 border-l-2 border-brand bg-band px-4 py-3 text-sm">
          Rozměrné zboží vozíme vlastním autem nebo paletovou přepravou, případně si ho vyzvednete na
          prodejně.
        </p>
      )}

      <p className="mt-8 text-sm text-ink-soft">
        {inCategory.length}{" "}
        {inCategory.length === 1 ? "produkt" : inCategory.length < 5 ? "produkty" : "produktů"}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {inCategory.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
