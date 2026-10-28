import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Elektro Dvořák · spotřebiče, počítače, nářadí a zahradní technika",
    template: "%s · Elektro Dvořák",
  },
  description:
    "Televize a audio, velké i malé spotřebiče, počítače a telefony, nářadí a zahradní technika. Šest prodejen a odborný servis.",
};

/** Document shell only. The storefront and the admin bring their own chrome. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
