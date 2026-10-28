import { NextResponse } from "next/server";
import { z } from "zod";
import { bySlug, isBulky } from "@/data/catalog";
import { add, fromHaler, ZERO } from "@/domain/money";
import { quoteShipping } from "@/domain/shipping";
import { listConnections, listMethods } from "@/server/shipping/repo";
import { toDomainMethod } from "@/server/shipping/config";

/**
 * Delivery options for a cart.
 *
 * The browser sends what is in the cart, never a price. Everything else, the goods total
 * included, is recomputed here from the catalogue and priced by `src/domain/shipping.ts`,
 * so a cart edited in the console changes the shipping options it is offered but not what
 * any of them cost.
 */

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  items: z
    .array(z.object({ slug: z.string().min(1).max(200), qty: z.number().int().positive().max(999) }))
    .max(100),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  }

  const lines = parsed.data.items.flatMap((item) => {
    const product = bySlug(item.slug);
    return product === undefined ? [] : [{ product, qty: item.qty }];
  });

  const goodsMinor = lines.reduce(
    (sum, line) => add(sum, fromHaler(line.product.priceMinor * line.qty)),
    ZERO,
  );
  const hasBulky = lines.some((line) => isBulky(line.product.category));

  // No product carries a weight until the ERP feed does, so a pallet tariff will ask for
  // a manual quote. That is the honest answer, not a number invented from a missing one.
  const weights = lines.map((line) => line.product.weightKg);
  const weightKg = weights.every((weight) => weight !== null)
    ? lines.reduce((sum, line, index) => sum + (weights[index] ?? 0) * line.qty, 0)
    : null;

  const [methods, connections] = await Promise.all([listMethods(), listConnections()]);
  const enabledConnections = new Set(connections.filter((row) => row.enabled).map((row) => row.id));

  const options = methods
    .filter((method) => method.enabled && enabledConnections.has(method.connectionId))
    .filter((method) => !hasBulky || method.allowsBulky || method.pricing.kind === "store_pickup")
    .map((method) => {
      const quote = quoteShipping(
        toDomainMethod(method),
        { weightKg, volumeM3: null },
        { goodsMinor, codMinor: ZERO },
      );
      return {
        id: method.id,
        name: method.name,
        description: method.description,
        needsPickupPoint: method.needsPickupPoint,
        quote,
      };
    });

  return NextResponse.json({ goodsMinor, options });
}
