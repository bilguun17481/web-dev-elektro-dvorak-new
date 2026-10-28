import type { ReactNode } from "react";

/** Shared admin chrome. Plain, dense and legible: this is a working screen, not a shopfront. */

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink">{label}</span>
      {children}
      {help !== undefined && help !== "" && (
        <span className="mt-1 block text-[11px] text-ink-soft">{help}</span>
      )}
    </label>
  );
}

export const inputClass =
  "mt-1 w-full border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-ink";

export function Banner({ kind, children }: { kind: "error" | "notice"; children: ReactNode }) {
  const tone =
    kind === "error" ? "border-brand bg-brand/5 text-brand-dark" : "border-hairline bg-band text-ink";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`border-l-2 px-4 py-3 text-sm ${tone}`}>
      {children}
    </p>
  );
}

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-hairline bg-white">
      <header className="border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description !== undefined && <p className="mt-1 text-xs text-ink-soft">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Submit({
  label,
  pending,
  tone = "primary",
}: {
  label: string;
  pending: boolean;
  tone?: "primary" | "quiet";
}) {
  const base =
    "px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-50";
  const look =
    tone === "primary"
      ? "bg-ink text-white hover:bg-brand"
      : "border border-hairline text-ink hover:border-ink";
  return (
    <button type="submit" disabled={pending} className={`${base} ${look}`}>
      {pending ? "Pracuji…" : label}
    </button>
  );
}
