"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";

export function AddToCart({ slug }: { slug: string }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        add(slug);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 2000);
      }}
      className="w-full bg-brand px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-brand-dark sm:w-auto"
    >
      {added ? "Přidáno do košíku" : "Do košíku"}
    </button>
  );
}
