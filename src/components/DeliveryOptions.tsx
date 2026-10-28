"use client";

import { useEffect, useState } from "react";
import type { Minor } from "@/domain/money";
import { formatKc, fromHaler } from "@/domain/money";
import type { CartItem } from "@/lib/cart";

interface Option {
  id: string;
  name: string;
  description: string;
  needsPickupPoint: boolean;
  quote:
    | { kind: "price"; minor: number; vatRateBp: number }
    | { kind: "manual_quote"; reason: string }
    | { kind: "unavailable"; reason: string };
}

/**
 * What the admin configured, as the customer sees it. The prices come from the server,
 * which recomputes them from the catalogue; this component only formats them.
 */
export function DeliveryOptions({ items }: { items: readonly CartItem[] }) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    const controller = new AbortController();

    fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("quote failed"))))
      .then((data: { options: Option[] }) => setOptions(data.options))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, [items]);

  if (failed) {
    return <p className="text-sm text-ink-soft">Dopravu spočítáme v dalším kroku.</p>;
  }
  if (options === null) {
    return <p className="text-sm text-ink-soft">Počítám dopravu…</p>;
  }
  if (options.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Zatím není nastavený žádný způsob dopravy. Doplníte ho ve správě, v sekci Doprava.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {options.map((option) => (
        <li key={option.id} className="flex items-start justify-between gap-4 py-3 text-sm">
          <span>
            <span className="font-medium">{option.name}</span>
            {option.description !== "" && (
              <span className="block text-xs text-ink-soft">{option.description}</span>
            )}
            {option.needsPickupPoint && (
              <span className="block text-xs text-ink-soft">Vyberete výdejní místo</span>
            )}
          </span>
          <span className="shrink-0 text-right">
            {option.quote.kind === "price" ? (
              option.quote.minor === 0 ? (
                "Zdarma"
              ) : (
                formatKc(fromHaler(option.quote.minor) as Minor)
              )
            ) : (
              <span className="text-xs text-ink-soft">
                {option.quote.kind === "manual_quote" ? "Cenu potvrdíme" : "Nelze použít"}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
