"use client";

import { useActionState } from "react";
import { EMPTY_STATE } from "@/app/admin/action-state";
import { deleteMethodAction } from "@/app/admin/actions";
import { Banner, Submit } from "./ui";

export function MethodRow({
  id,
  name,
  summary,
  enabled,
}: {
  id: string;
  name: string;
  summary: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(deleteMethodAction, EMPTY_STATE);

  return (
    <li className="flex flex-wrap items-center gap-4 border border-hairline p-4">
      <div className="flex-1">
        <p className="text-sm font-medium">
          {name}
          {!enabled && <span className="ml-2 text-xs text-ink-soft">(vypnuto)</span>}
        </p>
        <p className="mt-1 text-xs text-ink-soft">{summary}</p>
        {state.error !== null && (
          <div className="mt-2">
            <Banner kind="error">{state.error}</Banner>
          </div>
        )}
      </div>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Submit label="Smazat" pending={pending} tone="quiet" />
      </form>
    </li>
  );
}
