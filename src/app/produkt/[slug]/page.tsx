import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { Price } from "@/components/Price";
import { bySlug, categories, products } from "@/data/catalog";
import { stores } from "@/data/stores";
import { productImage } from "@/lib/images";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = bySlug(slug);
  if (product === undefined) return {};
  return {
    title: `${product.brand} ${product.name}`,
    description: product.short.cs,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = bySlug(slug);
  if (product === undefined) notFound();

  const category = categories.find((c) => c.slug === product.category);
  const image = productImage(product.slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="Navigace" className="text-xs uppercase tracking-wider text-ink-soft">
        <Link href="/">Úvod</Link>
        {category !== undefined && (
          <>
            <span className="px-2" aria-hidden>
              /
            </span>
            <Link href={`/kategorie/${category.slug}/`}>{category.label.cs}</Link>
          </>
        )}
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square border border-hairline bg-band">
          {image === null ? (
            <span className="flex h-full items-center justify-center text-sm text-ink-soft">
              Fotografie se doplní
            </span>
          ) : (
            <Image
              src={image}
              alt={`${product.brand} ${product.name}`}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain p-8"
            />
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            {product.brand}
          </p>
          <h1 className="balance mt-2 text-3xl font-semibold leading-tight">{product.name}</h1>

          <div className="mt-6 flex items-baseline gap-3">
            <Price amount={product.priceMinor} className="text-3xl font-semibold" />
            <span className="text-sm text-ink-soft">s DPH</span>
          </div>

          <p className="mt-5 leading-relaxed text-ink-soft">{product.short.cs}</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {product.energy !== "—" && (
              <>
                <dt className="text-ink-soft">Energetická třída</dt>
                <dd className="font-medium">{product.energy}</dd>
              </>
            )}
            {product.size !== undefined && (
              <>
                <dt className="text-ink-soft">Rozměr</dt>
                <dd className="font-medium">{product.size}</dd>
              </>
            )}
            {product.power !== undefined && (
              <>
                <dt className="text-ink-soft">Výkon</dt>
                <dd className="font-medium">{product.power}</dd>
              </>
            )}
            {product.erpCode !== null && (
              <>
                <dt className="text-ink-soft">Kód</dt>
                <dd className="font-medium">{product.erpCode}</dd>
              </>
            )}
          </dl>

          <div className="mt-8">
            <AddToCart slug={product.slug} />
          </div>

          {/*
            Availability is deliberately not a number yet. The architecture requires stock
            to be shown per branch and honestly, and the only stock data that exists comes
            from an hourly snapshot that is frozen overnight, so inventing a figure here
            would be the one thing the rule forbids.
          */}
          <div className="mt-8 border border-hairline bg-band p-5 text-sm">
            <p className="font-medium">Dostupnost na prodejnách</p>
            <p className="mt-1 text-ink-soft">
              Skladovou dostupnost zobrazíme pro každou prodejnu zvlášť, až se spustí přenos dat ze skladu.
              Zatím se prosím zeptejte na prodejně.
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
              {stores.map((store) => (
                <li key={store.erpCode}>{store.name}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {product.specs.length > 0 && (
        <section className="mt-16 max-w-3xl">
          <h2 className="text-xl font-semibold">Parametry</h2>
          <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-sm">
            {product.specs.map((spec) => (
              <div key={spec.label.cs} className="grid grid-cols-2 gap-4 py-3">
                <dt className="text-ink-soft">{spec.label.cs}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
