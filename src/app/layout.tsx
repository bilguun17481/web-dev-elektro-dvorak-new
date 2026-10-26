import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CartProvider } from "@/lib/cart";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Elektro Dvořák · spotřebiče, počítače, nářadí a zahradní technika",
    template: "%s · Elektro Dvořák",
  },
  description:
    "Televize a audio, velké i malé spotřebiče, počítače a telefony, nářadí a zahradní technika. Šest prodejen a odborný servis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="font-sans antialiased">
        <CartProvider>
          <Header />
          <main className="min-h-[60vh]">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
