import Link from "next/link";
import { listProviders } from "@/adapters/carriers/registry";
import { Card } from "@/components/admin/ui";
import { localLoginEnabled } from "@/server/auth";
import { hasSecretsKey } from "@/server/secrets";
import { listConnections, listMethods } from "@/server/shipping/repo";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [connections, methods] = await Promise.all([listConnections(), listMethods()]);
  const providers = listProviders();

  const checks = [
    {
      label: "Šifrovací klíč pro přístupové údaje",
      ok: hasSecretsKey(),
      detail: hasSecretsKey() ? "Nastaven" : "Chybí SECRETS_KEY, bez něj nelze uložit API klíč.",
    },
    {
      label: "Připojení dopravců",
      ok: connections.length > 0,
      detail: `${connections.length} připojeno, ${connections.filter((c) => c.lastTestOk === true).length} ověřeno`,
    },
    {
      label: "Způsoby dopravy",
      ok: methods.some((method) => method.enabled),
      detail: `${methods.filter((method) => method.enabled).length} aktivních z ${methods.length}`,
    },
    {
      label: "Přihlašování",
      ok: !localLoginEnabled(),
      detail: localLoginEnabled()
        ? "Místní přihlášení je zapnuté. Před spuštěním naostro připojte Supabase a ADMIN_LOCAL_LOGIN odeberte."
        : "Přes Supabase",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Přehled</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Co je hotové a co ještě chybí, než se dá e-shop pustit naostro.
        </p>
      </div>

      <Card title="Nastavení">
        <ul className="space-y-3">
          {checks.map((check) => (
            <li key={check.label} className="flex gap-3 text-sm">
              <span aria-hidden className={check.ok ? "text-ink" : "text-brand"}>
                {check.ok ? "✓" : "!"}
              </span>
              <span>
                <span className="font-medium">{check.label}</span>
                <span className="block text-xs text-ink-soft">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Doprava"
        description={`${providers.length} dostupných poskytovatelů. Dalšího dopravce přidáte bez zásahu do kódu.`}
      >
        <Link
          href="/admin/doprava/"
          className="inline-block bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-brand"
        >
          Nastavit dopravu
        </Link>
      </Card>
    </div>
  );
}
