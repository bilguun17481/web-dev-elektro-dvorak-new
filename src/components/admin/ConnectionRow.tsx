"use client";

import { useActionState } from "react";
import { EMPTY_STATE } from "@/app/admin/action-state";
import { deleteConnectionAction, testConnectionAction } from "@/app/admin/actions";
import type { SafeConnection } from "@/server/shipping/repo";
import { Banner, Submit } from "./ui";

export function ConnectionRow({
  connection,
  providerLabel,
  canTest,
  methodCount,
}: {
  connection: SafeConnection;
  providerLabel: string;
  canTest: boolean;
  methodCount: number;
}) {
  const [testState, testAction, testing] = useActionState(testConnectionAction, EMPTY_STATE);
  const [deleteState, deleteAction, deleting] = useActionState(deleteConnectionAction, EMPTY_STATE);

  const tested =
    connection.lastTestedAt === null
      ? "Zatím neověřeno"
      : `${connection.lastTestOk === true ? "Ověřeno" : "Chyba"} · ${new Intl.DateTimeFormat("cs-CZ", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(connection.lastTestedAt))}`;

  return (
    <li className="border border-hairline p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">
            {connection.label}
            {!connection.enabled && <span className="ml-2 text-xs text-ink-soft">(vypnuto)</span>}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {providerLabel} · {methodCount} {methodCount === 1 ? "způsob dopravy" : "způsobů dopravy"}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {tested}
            {connection.lastTestMessage !== null && ` · ${connection.lastTestMessage}`}
          </p>
          {connection.secretsSet.length > 0 && (
            <p className="mt-1 text-[11px] text-ink-soft">
              Uložené klíče: {connection.secretsSet.join(", ")} (zobrazit nelze, lze jen přepsat)
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {canTest && (
            <form action={testAction}>
              <input type="hidden" name="id" value={connection.id} />
              <Submit label="Ověřit spojení" pending={testing} tone="quiet" />
            </form>
          )}
          <form action={deleteAction}>
            <input type="hidden" name="id" value={connection.id} />
            <Submit label="Smazat" pending={deleting} tone="quiet" />
          </form>
        </div>
      </div>

      {testState.error !== null && (
        <div className="mt-3">
          <Banner kind="error">{testState.error}</Banner>
        </div>
      )}
      {testState.notice !== null && (
        <div className="mt-3">
          <Banner kind="notice">{testState.notice}</Banner>
        </div>
      )}
      {deleteState.error !== null && (
        <div className="mt-3">
          <Banner kind="error">{deleteState.error}</Banner>
        </div>
      )}
    </li>
  );
}
