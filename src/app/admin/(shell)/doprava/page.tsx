import { listProviders, providerById } from "@/adapters/carriers/registry";
import { ConnectionForm } from "@/components/admin/ConnectionForm";
import { ConnectionRow } from "@/components/admin/ConnectionRow";
import { MethodForm } from "@/components/admin/MethodForm";
import { MethodRow } from "@/components/admin/MethodRow";
import { Banner, Card } from "@/components/admin/ui";
import { formatKc, fromHaler } from "@/domain/money";
import type { StoredShippingMethod } from "@/server/shipping/config";
import { hasSecretsKey } from "@/server/secrets";
import { carriersFor, listConnections, listMethods } from "@/server/shipping/repo";

export const dynamic = "force-dynamic";

/** Describes a tariff in the words the person configuring it would use. */
function describe(method: StoredShippingMethod, connectionLabel: string): string {
  const pricing = method.pricing;
  const where = `${connectionLabel} · ${method.carrierCode}`;

  if (pricing.kind === "store_pickup") return `${where} · zdarma`;

  if (pricing.kind === "fofr_pallet") {
    return `${where} · (${pricing.baseKc} + ${pricing.perKgKc} × kg) + ${pricing.fixedFeeKc} Kč, min. ${pricing.minChargeableKg} kg`;
  }

  const free =
    pricing.freeOverMinor === null ? "" : `, zdarma od ${formatKc(fromHaler(pricing.freeOverMinor))}`;
  const cod = pricing.codFeeMinor === 0 ? "" : `, dobírka +${formatKc(fromHaler(pricing.codFeeMinor))}`;
  return `${where} · ${formatKc(fromHaler(pricing.priceMinor))}${free}${cod}`;
}

export default async function ShippingSettingsPage() {
  const [connections, methods] = await Promise.all([listConnections(), listMethods()]);
  const providers = listProviders();

  const labelFor = new Map(connections.map((connection) => [connection.id, connection.label]));
  const choices = connections.map((connection) => ({
    id: connection.id,
    label: connection.label,
    carriers: carriersFor(connection),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Doprava</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Připojte dopravce a nastavte, co z toho zákazník uvidí v košíku. Nový dopravce ani nový ceník
          nevyžadují zásah do kódu.
        </p>
      </div>

      {!hasSecretsKey() && (
        <Banner kind="error">
          Chybí SECRETS_KEY. Bez něj nelze uložit API klíč, protože by se musel uložit nezašifrovaný.
        </Banner>
      )}

      <Card title="Připojení dopravců" description="Jedno připojení může obsluhovat více dopravců.">
        {connections.length === 0 ? (
          <p className="text-sm text-ink-soft">Zatím žádné připojení.</p>
        ) : (
          <ul className="space-y-3">
            {connections.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                providerLabel={providerById(connection.providerId)?.definition.label ?? connection.providerId}
                canTest={providerById(connection.providerId)?.definition.capabilities.testConnection ?? false}
                methodCount={methods.filter((method) => method.connectionId === connection.id).length}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Přidat připojení">
        <ConnectionForm providers={providers} />
      </Card>

      <Card title="Způsoby dopravy" description="To, co si zákazník vybere v košíku.">
        {methods.length === 0 ? (
          <p className="text-sm text-ink-soft">Zatím žádný způsob dopravy.</p>
        ) : (
          <ul className="space-y-3">
            {methods.map((method) => (
              <MethodRow
                key={method.id}
                id={method.id}
                name={method.name}
                enabled={method.enabled}
                summary={describe(method, labelFor.get(method.connectionId) ?? "?")}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Přidat způsob dopravy">
        <MethodForm connections={choices} />
      </Card>
    </div>
  );
}
