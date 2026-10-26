"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

/**
 * The cart holds slugs and quantities and nothing else. It deliberately does not hold
 * prices: the server prices the order at checkout through `computeTotals`, so a cart
 * tampered with in the browser cannot change what is charged.
 *
 * localStorage is an external store, so it is read through `useSyncExternalStore` rather
 * than copied into state inside an effect. That keeps the server and the first client
 * render in agreement, avoids a cascading render on mount, and makes the cart follow
 * along when the customer has the shop open in a second tab.
 */
export interface CartItem {
  readonly slug: string;
  readonly qty: number;
}

interface CartApi {
  readonly items: readonly CartItem[];
  readonly count: number;
  add: (slug: string, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "ed.cart.v1";

const EMPTY: readonly CartItem[] = [];

/** Cached so `getSnapshot` is referentially stable between stored writes. */
let cache: readonly CartItem[] | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): readonly CartItem[] {
  if (raw === null) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const items = parsed.flatMap((entry): CartItem[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const { slug, qty } = entry as Partial<CartItem>;
      if (typeof slug !== "string" || slug === "" || !Number.isFinite(qty)) return [];
      return [{ slug, qty: Math.max(1, Math.trunc(qty as number)) }];
    });
    return items.length === 0 ? EMPTY : items;
  } catch {
    // Corrupted or unreadable storage must not take the shop down with it.
    return EMPTY;
  }
}

function getSnapshot(): readonly CartItem[] {
  if (cache === null) {
    try {
      cache = parse(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function getServerSnapshot(): readonly CartItem[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    for (const notify of listeners) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: readonly CartItem[]): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode; the cart still works for this page view */
  }
  for (const notify of listeners) notify();
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((slug: string, qty = 1) => {
    const current = getSnapshot();
    const existing = current.find((item) => item.slug === slug);
    write(
      existing === undefined
        ? [...current, { slug, qty: Math.max(1, qty) }]
        : current.map((item) => (item.slug === slug ? { ...item, qty: item.qty + Math.max(1, qty) } : item)),
    );
  }, []);

  const setQty = useCallback((slug: string, qty: number) => {
    const current = getSnapshot();
    write(
      qty <= 0
        ? current.filter((item) => item.slug !== slug)
        : current.map((item) => (item.slug === slug ? { ...item, qty: Math.trunc(qty) } : item)),
    );
  }, []);

  const remove = useCallback((slug: string) => {
    write(getSnapshot().filter((item) => item.slug !== slug));
  }, []);

  const clear = useCallback(() => write(EMPTY), []);

  const api = useMemo<CartApi>(
    () => ({ items, count: items.reduce((sum, item) => sum + item.qty, 0), add, setQty, remove, clear }),
    [items, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const context = useContext(CartContext);
  if (context === null) throw new Error("useCart must be used inside CartProvider");
  return context;
}
