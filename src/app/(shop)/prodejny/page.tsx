import type { Metadata } from "next";
import { stores } from "@/data/stores";

export const metadata: Metadata = {
  title: "Prodejny",
  description: "Šest prodejen Elektro Dvořák. Na každé si můžete objednávku vyzvednout zdarma.",
};

export default function StoresPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold">Prodejny</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Objednávku vyzvednete zdarma na kterékoli z nich. Adresy a otevírací doba se doplní ze nastavení
        prodejen.
      </p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <li key={store.erpCode} className="border border-hairline p-6">
            <h2 className="text-lg font-medium">{store.name}</h2>
            <p className="mt-2 text-sm text-ink-soft">{store.address}</p>
            <p className="mt-4 text-xs uppercase tracking-wider text-ink-soft">Osobní odběr zdarma</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
