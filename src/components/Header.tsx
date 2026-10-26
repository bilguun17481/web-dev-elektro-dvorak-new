"use client";

import Link from "next/link";
import { categories } from "@/data/catalog";
import { useCart } from "@/lib/cart";

export function Header() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          Elektro <span className="text-brand">Dvořák</span>
        </Link>

        <nav aria-label="Hlavní navigace" className="hidden flex-1 lg:block">
          <ul className="flex items-center justify-center gap-6 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/kategorie/${category.slug}/`} className="transition-colors hover:text-ink">
                  {category.nav.cs}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/prodejny/" className="transition-colors hover:text-ink">
                Prodejny
              </Link>
            </li>
          </ul>
        </nav>

        <Link
          href="/kosik/"
          className="ml-auto flex shrink-0 items-center gap-2 text-sm font-medium lg:ml-0"
          aria-label={`Košík, ${count} ${count === 1 ? "položka" : "položek"}`}
        >
          Košík
          <span className="inline-flex min-w-6 justify-center rounded-full bg-ink px-2 py-0.5 text-xs text-white">
            {count}
          </span>
        </Link>
      </div>

      <nav aria-label="Kategorie" className="border-t border-hairline lg:hidden">
        <ul className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 py-2 text-xs uppercase tracking-wider text-ink-soft">
          {categories.map((category) => (
            <li key={category.slug} className="shrink-0">
              <Link href={`/kategorie/${category.slug}/`}>{category.nav.cs}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
