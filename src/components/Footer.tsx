import Link from "next/link";
import { categories } from "@/data/catalog";
import { stores } from "@/data/stores";

export function Footer() {
  return (
    <footer className="mt-20 bg-ink text-sm text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <p className="text-base font-semibold text-white">
            Elektro <span className="text-white/60">Dvořák</span>
          </p>
          <p className="mt-3 leading-relaxed">
            Dvořák a synové, s.r.o. Spotřebiče, počítače, nářadí a zahradní technika se servisem a dopravou po
            okolí.
          </p>
        </div>

        <div>
          <p className="font-medium text-white">Nabídka</p>
          <ul className="mt-3 space-y-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/kategorie/${category.slug}/`} className="hover:text-white">
                  {category.label.cs}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-medium text-white">Prodejny</p>
          <ul className="mt-3 space-y-2">
            {stores.map((store) => (
              <li key={store.erpCode}>{store.name}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-medium text-white">Informace</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/prodejny/" className="hover:text-white">
                Kde nás najdete
              </Link>
            </li>
            <li>
              <Link href="/kosik/" className="hover:text-white">
                Košík
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs sm:px-6">
          © {new Date().getFullYear()} Dvořák a synové, s.r.o.
        </p>
      </div>
    </footer>
  );
}
