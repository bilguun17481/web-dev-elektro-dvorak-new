import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/data/catalog";
import { Price } from "@/components/Price";
import { productImage } from "@/lib/images";

const badge: Record<string, string> = {
  new: "Novinka",
  sale: "Akce",
  demo: "Předváděcí",
};

export function ProductCard({ product }: { product: Product }) {
  const image = productImage(product.slug);

  return (
    <article className="group flex h-full flex-col border border-hairline bg-white transition-shadow hover:shadow-md">
      <Link href={`/produkt/${product.slug}/`} className="relative block aspect-4/3 overflow-hidden bg-band">
        {image === null ? (
          <span className="flex h-full items-center justify-center text-xs uppercase tracking-wider text-ink-soft">
            Bez fotografie
          </span>
        ) : (
          <Image
            src={image}
            alt={`${product.brand} ${product.name}`}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        {product.tags !== undefined && product.tags.length > 0 && (
          <span className="absolute left-0 top-3 bg-brand px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            {badge[product.tags[0] ?? ""] ?? product.tags[0]}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft">{product.brand}</p>
        <h3 className="balance text-sm font-medium leading-snug">
          <Link href={`/produkt/${product.slug}/`}>{product.name}</Link>
        </h3>
        {product.energy !== "—" && (
          <p className="text-xs text-ink-soft">
            Energetická třída <span className="font-semibold text-ink">{product.energy}</span>
          </p>
        )}
        <div className="mt-auto pt-2">
          <Price amount={product.priceMinor} className="text-lg font-semibold" />
          <p className="text-[11px] text-ink-soft">s DPH</p>
        </div>
      </div>
    </article>
  );
}
