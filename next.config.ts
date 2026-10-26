import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Czech-only storefront for now; the multi-shop core resolves the shop by hostname
  // in middleware, so no i18n routing segment is needed.
  trailingSlash: true,
  poweredByHeader: false,
  images: {
    // Product photography is served from R2 once the image pipeline lands.
    remotePatterns: [],
  },
  typedRoutes: true,
};

export default nextConfig;
