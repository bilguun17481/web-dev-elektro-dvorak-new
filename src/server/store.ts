import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StoredCarrierConnection, StoredShippingMethod } from "@/server/shipping/config";
import { carrierConnectionSchema, shippingMethodSchema } from "@/server/shipping/config";

/**
 * Where the admin's settings live.
 *
 * Today that is a JSON file, which is honest about the stage this is at: there is no
 * Supabase project yet, and a file lets the admin be used and judged now. It is a
 * development backend and nothing else. It will not survive a serverless deploy, where
 * two instances have two files and neither is the truth.
 *
 * `supabase/migrations/0001_carriers.sql` holds the real schema with its RLS. When the
 * project exists, a Supabase implementation of `ShopStore` replaces `fileStore` and
 * nothing above this file changes, which is the reason the interface is here at all.
 */

export interface ShopData {
  readonly connections: readonly StoredCarrierConnection[];
  readonly methods: readonly StoredShippingMethod[];
}

export interface ShopStore {
  read(): Promise<ShopData>;
  /** Serialised, so two admin tabs saving at once cannot interleave into a lost update. */
  update(mutate: (current: ShopData) => ShopData): Promise<ShopData>;
}

const EMPTY: ShopData = { connections: [], methods: [] };

function dataPath(): string {
  return process.env["SHOP_DATA_FILE"] ?? join(process.cwd(), ".data", "shop.json");
}

function parse(raw: string): ShopData {
  const parsed: unknown = JSON.parse(raw);
  const shape = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};

  // Rows that no longer match the schema are dropped rather than crashing the admin,
  // which is what lets the shape change while the file on disk is still the old one.
  const connections = (Array.isArray(shape["connections"]) ? shape["connections"] : []).flatMap((row) => {
    const result = carrierConnectionSchema.safeParse(row);
    return result.success ? [result.data] : [];
  });
  const methods = (Array.isArray(shape["methods"]) ? shape["methods"] : []).flatMap((row) => {
    const result = shippingMethodSchema.safeParse(row);
    return result.success ? [result.data] : [];
  });

  return { connections, methods };
}

function createFileStore(): ShopStore {
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<ShopData> {
    try {
      return parse(await readFile(/* turbopackIgnore: true */ dataPath(), "utf8"));
    } catch (cause) {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return EMPTY;
      throw cause;
    }
  }

  async function write(data: ShopData): Promise<void> {
    const path = dataPath();
    await mkdir(/* turbopackIgnore: true */ dirname(path), { recursive: true });
    // Write then rename, so a crash mid-write cannot leave half a settings file.
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(/* turbopackIgnore: true */ temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(/* turbopackIgnore: true */ temporary, path);
  }

  return {
    read,
    update(mutate) {
      const next = queue.then(async () => {
        const data = mutate(await read());
        await write(data);
        return data;
      });
      // Keep the chain going even when one caller's mutation throws.
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

let store: ShopStore | null = null;

export function getStore(): ShopStore {
  store ??= createFileStore();
  return store;
}

/** Lets tests swap in a store without touching the filesystem. */
export function setStore(replacement: ShopStore | null): void {
  store = replacement;
}
