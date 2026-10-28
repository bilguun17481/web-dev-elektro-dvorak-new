import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";
import { currentSession } from "@/server/auth";

/**
 * Everything in this group is behind the login. The check is here rather than in proxy.ts
 * because proxy sees a cookie, not a verified session, and an admin guard should not be
 * the one place that trusts an unverified value.
 */
export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (session === null) redirect("/admin/login/");

  const links = [
    { href: "/admin/", label: "Přehled" },
    { href: "/admin/doprava/", label: "Doprava" },
  ];

  return (
    <div className="min-h-screen bg-band">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/admin/" className="text-sm font-semibold">
            Elektro <span className="text-brand">Dvořák</span> · správa
          </Link>
          <nav className="flex gap-4 text-xs uppercase tracking-[0.12em] text-ink-soft">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-xs text-ink-soft">
            <span>
              {session.email} · {session.role}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="underline hover:text-ink">
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
