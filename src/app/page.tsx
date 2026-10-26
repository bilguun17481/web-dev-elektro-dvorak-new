import Image from "next/image";
import Link from "next/link";
import { categories, products } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";
import { categoryImage } from "@/lib/images";
import { stores } from "@/data/stores";

const featured = products.filter((p) => p.tags?.includes("new") === true).slice(0, 8);

export default function HomePage() {
  const hero = categoryImage("velke-spotrebice", "wide");

  return (
    <>
      <section className="relative isolate flex min-h-[62vh] items-end border-b border-hairline bg-band">
        {hero !== null && (
          <Image src={hero} alt="" fill priority sizes="100vw" className="object-cover" aria-hidden />
        )}
        {/*
          Two overlays, not one. The bottom-up gradient alone leaves the eyebrow and
          headline sitting over whatever the photograph happens to be, and product
          photography is mostly white goods on a white background. The left-to-right
          layer gives the text column a dark backdrop whatever the image behind it,
          which is what keeps the contrast at AA.
        */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
            Šest prodejen · vlastní servis · doprava po okolí
          </p>
          <h1 className="balance mt-4 max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Spotřebiče, nářadí a zahradní technika od lidí, kteří je znají
          </h1>
          <p className="mt-4 max-w-xl text-white/85">
            Přivezeme, zapojíme a postaráme se i o záruční servis. Osobní odběr na kterékoli z našich prodejen
            je zdarma.
          </p>
          <Link
            href="/kategorie/velke-spotrebice/"
            className="mt-7 inline-block bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-brand hover:text-white"
          >
            Prohlédnout nabídku
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold">Co u nás najdete</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const tile = categoryImage(category.slug, "tile");
            return (
              <Link
                key={category.slug}
                href={`/kategorie/${category.slug}/`}
                className="group relative isolate flex aspect-16/10 items-end overflow-hidden border border-hairline bg-band"
              >
                {tile !== null && (
                  <Image
                    src={tile}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    aria-hidden
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" aria-hidden />
                <div className="relative p-5">
                  <h3 className="text-lg font-semibold text-white">{category.label.cs}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-white/80">{category.blurb.cs}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="border-y border-hairline bg-band">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold">Novinky v nabídce</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold">Vyzvednete si zdarma na prodejně</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <li key={store.erpCode} className="border border-hairline p-5">
              <p className="font-medium">{store.name}</p>
              <p className="mt-1 text-sm text-ink-soft">Osobní odběr zdarma</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
