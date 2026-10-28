"use client";

import { useActionState } from "react";
import { EMPTY_STATE } from "@/app/admin/action-state";
import { loginAction } from "@/app/admin/actions";
import { Banner, Field, Submit, inputClass } from "@/components/admin/ui";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, EMPTY_STATE);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-xl font-semibold">
        Elektro <span className="text-brand">Dvořák</span> · správa
      </h1>
      <p className="mt-2 text-sm text-ink-soft">Přihlaste se do administrace.</p>

      <form action={formAction} className="mt-8 space-y-4">
        {state.error !== null && <Banner kind="error">{state.error}</Banner>}

        <Field label="E-mail">
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={state.email ?? ""}
            key={state.email ?? ""}
            className={inputClass}
          />
        </Field>

        <Field label="Heslo">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>

        <Submit label="Přihlásit se" pending={pending} />
      </form>
    </div>
  );
}
