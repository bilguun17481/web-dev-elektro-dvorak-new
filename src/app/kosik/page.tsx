"use client";

import Link from "next/link";
import Image from "next/image";
import { Price } from "@/components/Price";
import { bySlug } from "@/data/catalog";
import { computeTotals } from "@/domain/pricing";
import { useCart } from "@/lib/cart";
import { productImage } from "@/lib/images";

export default function CartPage() {
  const { items, setQty, remove } = useCart();

  const lines = items.flatMap((item) => {
    const product = bySlug(item.slug);
    return product === undefined
      ? []
      : [
          {
            productId: product.slug,
            code: product.erpCode ?? product.slug,
            name: `${product.brand} ${product.name}`,
            unitPriceMinor: product.priceMinor,
            vatRateBp: product.vatRateBp,
            qty: item.qty,
          },
        ];
  });

  /*
    The same pure function the server uses, so the figure here and the figure charged come
    from one implementation. It is still only a display: checkout re-prices from the
    database and ignores anything this page sends.
  */
  const totals = computeTotals({ lines, shipping: null, discount: null, pricesIncludeVat: true });

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Košík je prázdný</h1>
        <p className="mt-3 text-ink-soft">Vyberte si z naší nabídky a vraťte se sem.</p>
        <Link
          href="/"
          className="mt-8 inline-block bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white"
        >
          Zpět do nabídky
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Košík</h1>

      <ul className="mt-10 divide-y divide-hairline border-y border-hairline">
        {totals.lines.map((line) => {
          const image = productImage(line.productId);
          return (
            <li key={line.productId} className="flex gap-4 py-5">
              <div className="relative h-20 w-20 shrink-0 border border-hairline bg-band">
                {image !== null && (
                  <Image src={image} alt="" fill sizes="80px" className="object-contain p-1" aria-hidden />
                )}
              </div>

              <div className="flex-1">
                <Link href={`/produkt/${line.productId}/`} className="text-sm font-medium">
                  {line.name}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">
                  <Price amount={line.unitPriceMinor} /> / ks
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-ink-soft" htmlFor={`qty-${line.productId}`}>
                    Počet
                  </label>
                  <input
                    id={`qty-${line.productId}`}
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(event) => setQty(line.productId, Number(event.target.value))}
                    className="w-16 border border-hairline px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => remove(line.productId)}
                    className="text-xs text-ink-soft underline hover:text-brand"
                  >
                    Odebrat
                  </button>
                </div>
              </div>

              <Price amount={line.lineTotalMinor} className="text-sm font-semibold" />
            </li>
          );
        })}
      </ul>

      <div className="mt-8 ml-auto max-w-sm text-sm">
        <div className="flex justify-between py-1">
          <span className="text-ink-soft">Zboží</span>
          <Price amount={totals.subtotalMinor} />
        </div>
        {totals.vat.groups.map((group) => (
          <div key={group.rateBp} className="flex justify-between py-1 text-ink-soft">
            <span>z toho DPH {group.rateBp / 100} %</span>
            <Price amount={group.vatMinor} />
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-hairline pt-3 text-base font-semibold">
          <span>Celkem</span>
          <Price amount={totals.totalMinor} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">Dopravu a platbu vyberete v dalším kroku.</p>
      </div>
    </div>
  );
}
