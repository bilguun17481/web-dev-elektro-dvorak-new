import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { redirectFor } from "@/server/redirects";

/**
 * Next 16 renamed middleware to proxy; the runtime is Node and cannot be changed.
 *
 * Every URL the old site had must resolve in one hop. The target is built with a plain
 * URL rather than `nextUrl.clone()` because NextURL re-normalises the path against the
 * `trailingSlash` setting and drops the trailing slash, which turned the redirect into
 * 301 then 308 then the page: three requests where one will do.
 *
 * Old URLs all end in `.html`, which is what the matcher filters on, so the lookup never
 * runs for a page of the new site.
 */
export function proxy(request: NextRequest) {
  const target = redirectFor(request.nextUrl.pathname);
  if (target === null) return NextResponse.next();

  return NextResponse.redirect(new URL(target, request.nextUrl.origin), 301);
}

export const config = {
  matcher: "/:path*.html",
};
