import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Správa", template: "%s · Správa" },
  // The admin must never be indexed, whatever the hosting does about it.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
