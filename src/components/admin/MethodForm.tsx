"use client";

import { useActionState, useState } from "react";
import { EMPTY_STATE } from "@/app/admin/action-state";
import { saveMethodAction } from "@/app/admin/actions";
import { Banner, Field, Submit, inputClass } from "./ui";

export interface ConnectionChoice {
  readonly id: string;
  readonly label: string;
  readonly carriers: readonly { code: string; label: string }[];
}

const KINDS = [
  { value: "flat", label: "Pevná cena" },
  { value: "store_pickup", label: "Osobní odběr (zdarma)" },
  { value: "own_delivery", label: "Vlastní doprava" },
  { value: "fofr_pallet", label: "Paletová přeprava (FOFR)" },
] as const;

/** Tariff defaults mirror `defaultPricing` so a new method starts from sane numbers. */
const FOFR_DEFAULTS = {
  baseKc: 17.52,
  perKgKc: 9.542,
  minChargeableKg: 15.65,
  fixedFeeKc: 26,
  fuelSurchargePercent: 0,
  codRatePercent: 1.5,
  volumetricKgPerM3: 122,
  codCeilingKc: 21600,
  insuranceLimitKc: 25000,
};

export function MethodForm({ connections }: { connections: readonly ConnectionChoice[] }) {
  const [state, formAction, pending] = useActionState(saveMethodAction, EMPTY_STATE);
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [kind, setKind] = useState<string>("flat");

  const connection = connections.find((candidate) => candidate.id === connectionId);
  const isFlat = kind === "flat" || kind === "own_delivery";

  if (connections.length === 0) {
    return <p className="text-sm text-ink-soft">Nejprve přidejte připojení dopravce.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error !== null && <Banner kind="error">{state.error}</Banner>}
      {state.notice !== null && <Banner kind="notice">{state.notice}</Banner>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Připojení">
          <select
            name="connectionId"
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
            className={inputClass}
          >
            {connections.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Kód dopravce"
          help="Vyberte ze seznamu, nebo napište vlastní kód. Seznam se doplní po ověření spojení."
        >
          <input name="carrierCode" list="carrier-codes" required defaultValue="" className={inputClass} />
          <datalist id="carrier-codes">
            {(connection?.carriers ?? []).map((carrier) => (
              <option key={carrier.code} value={carrier.code}>
                {carrier.label}
              </option>
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="Název pro zákazníka" help="Takto se doprava jmenuje v košíku.">
        <input name="name" required placeholder="PPL na adresu" className={inputClass} />
      </Field>

      <Field label="Popis">
        <input name="description" placeholder="Doručení následující pracovní den" className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Způsob výpočtu ceny">
          <select
            name="pricingKind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className={inputClass}
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sazba DPH" help="V setinách procenta: 2100 je 21 %.">
          <input name="vatRateBp" type="number" defaultValue={2100} className={inputClass} />
        </Field>

        <Field label="Pořadí">
          <input name="sort" type="number" defaultValue={0} className={inputClass} />
        </Field>
      </div>

      {isFlat && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Cena (Kč)">
            <input name="priceKc" defaultValue="99" className={inputClass} />
          </Field>
          <Field label="Zdarma od (Kč)" help="Nechte prázdné, pokud doprava zdarma není.">
            <input name="freeOverKc" defaultValue="" className={inputClass} />
          </Field>
          <Field label="Příplatek za dobírku (Kč)">
            <input name="codFeeKc" defaultValue="39" className={inputClass} />
          </Field>
        </div>
      )}

      {kind === "fofr_pallet" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Základ (Kč)">
            <input name="baseKc" defaultValue={FOFR_DEFAULTS.baseKc} className={inputClass} />
          </Field>
          <Field label="Za kg (Kč)">
            <input name="perKgKc" defaultValue={FOFR_DEFAULTS.perKgKc} className={inputClass} />
          </Field>
          <Field label="Minimální účtovaná váha (kg)">
            <input
              name="minChargeableKg"
              defaultValue={FOFR_DEFAULTS.minChargeableKg}
              className={inputClass}
            />
          </Field>
          <Field label="Pevný poplatek (Kč)">
            <input name="fixedFeeKc" defaultValue={FOFR_DEFAULTS.fixedFeeKc} className={inputClass} />
          </Field>
          <Field label="Palivový příplatek (%)">
            <input
              name="fuelSurchargePercent"
              defaultValue={FOFR_DEFAULTS.fuelSurchargePercent}
              className={inputClass}
            />
          </Field>
          <Field label="Dobírka (% z částky)">
            <input name="codRatePercent" defaultValue={FOFR_DEFAULTS.codRatePercent} className={inputClass} />
          </Field>
          <Field label="1 m³ odpovídá (kg)">
            <input
              name="volumetricKgPerM3"
              defaultValue={FOFR_DEFAULTS.volumetricKgPerM3}
              className={inputClass}
            />
          </Field>
          <Field label="Strop dobírky (Kč)">
            <input name="codCeilingKc" defaultValue={FOFR_DEFAULTS.codCeilingKc} className={inputClass} />
          </Field>
          <Field label="Limit pojištění (Kč)">
            <input
              name="insuranceLimitKc"
              defaultValue={FOFR_DEFAULTS.insuranceLimitKc}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="enabled" defaultChecked />
          Aktivní
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsPickupPoint" />
          Zákazník vybírá výdejní místo
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allowsBulky" />
          Unese rozměrné zboží
        </label>
      </div>

      <Submit label="Uložit způsob dopravy" pending={pending} />
    </form>
  );
}
