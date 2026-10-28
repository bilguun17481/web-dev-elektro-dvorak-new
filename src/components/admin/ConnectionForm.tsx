"use client";

import { useActionState, useState } from "react";
import { EMPTY_STATE } from "@/app/admin/action-state";
import { saveConnectionAction } from "@/app/admin/actions";
import type { ProviderDefinition } from "@/adapters/carriers/types";
import { Banner, Field, Submit, inputClass } from "./ui";

/**
 * The form is generated from the provider's own `definition`, so connecting a provider
 * this component has never heard of needs no change here. That is what makes adding a
 * carrier an admin job rather than a development one.
 */
export function ConnectionForm({ providers }: { providers: readonly ProviderDefinition[] }) {
  const [state, formAction, pending] = useActionState(saveConnectionAction, EMPTY_STATE);
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");

  const provider = providers.find((candidate) => candidate.id === providerId);

  return (
    <form action={formAction} className="space-y-4">
      {state.error !== null && <Banner kind="error">{state.error}</Banner>}
      {state.notice !== null && <Banner kind="notice">{state.notice}</Banner>}

      <Field label="Poskytovatel">
        <select
          name="providerId"
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          className={inputClass}
        >
          {providers.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </Field>

      {provider !== undefined && (
        <>
          <p className="text-xs text-ink-soft">
            {provider.description}
            {provider.docsUrl !== null && (
              <>
                {" "}
                <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="underline">
                  Dokumentace
                </a>
              </>
            )}
          </p>

          <Field label="Označení" help="Jak se připojení jmenuje u vás. Může být cokoli.">
            <input name="label" defaultValue={provider.label} className={inputClass} />
          </Field>

          {provider.credentials.map((field) => (
            <Field key={field.key} label={field.label} help={field.help}>
              <input
                name={`cred.${field.key}`}
                type={field.kind === "secret" ? "password" : "text"}
                autoComplete="off"
                required={field.required && field.kind !== "secret"}
                defaultValue={field.kind === "secret" ? "" : (field.defaultValue ?? "")}
                placeholder={field.placeholder ?? ""}
                className={inputClass}
              />
            </Field>
          ))}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked />
            Aktivní
          </label>

          <Submit label="Uložit připojení" pending={pending} />
        </>
      )}
    </form>
  );
}
