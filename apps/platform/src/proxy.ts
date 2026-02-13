import { NextRequest, NextResponse } from "next/server";
import { hostBrandFromHost } from "@/lib/hostBrand";

const ROOT_PAGE_MAP: Record<string, string> = {
  "/": "/index.html",
  "/index.html": "/index.html",
  "/index2.html": "/index2.html",
  "/public-offer.html": "/public-offer.html",
  "/thanks": "/thanks.html",
  "/thanks.html": "/thanks.html",
  "/pay-failed": "/pay-failed.html",
  "/pay-failed.html": "/pay-failed.html",
};

const LEGACY_ASSET_PREFIXES = ["/css/", "/js/", "/img/", "/fonts/", "/libs/"];
const LEGACY_ROOT_FILES = new Set(["/main-short.css", "/media-short.css", "/Frame"]);

function rewriteLegacy(req: NextRequest, legacyPath: string) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const brand = hostBrandFromHost(host);
  if (!brand) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/legacy/${brand}${legacyPath}`;
  return NextResponse.rewrite(url);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Backend/runtime routes should stay untouched.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/pay/return") ||
    pathname.startsWith("/legacy/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const mappedPage = ROOT_PAGE_MAP[pathname];
  if (mappedPage) {
    return rewriteLegacy(req, mappedPage);
  }

  if (LEGACY_ASSET_PREFIXES.some((p) => pathname.startsWith(p))) {
    return rewriteLegacy(req, pathname);
  }

  if (LEGACY_ROOT_FILES.has(pathname)) {
    return rewriteLegacy(req, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sitemap.xml|robots.txt).*)"],
};
