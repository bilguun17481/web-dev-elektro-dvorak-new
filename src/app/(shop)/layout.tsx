import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CartProvider } from "@/lib/cart";

/**
 * The storefront's chrome. It lives in a route group rather than in the root layout so
 * that /admin does not inherit it: the admin had the shop's header, navigation and cart
 * badge sitting above the login form, which is both wrong and confusing.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </CartProvider>
  );
}
