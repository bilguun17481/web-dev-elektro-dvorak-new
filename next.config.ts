import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Czech-only storefront for now; the multi-shop core resolves the shop by hostname
  // in middleware, so no i18n routing segment is needed.
  trailingSlash: true,
  poweredByHeader: false,
  images: {
    // Seed photography is served straight from public/. The architecture puts it in R2
    // as WebP at four widths, and that pipeline brings the loader with it.
    unoptimized: true,
  },
};

export default nextConfig;
