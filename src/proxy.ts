import { NextRequest, NextResponse } from "next/server";
import { HostBrand, hostBrandFromHost } from "@/lib/hostBrand";

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

const LANDING_ASSET_PREFIXES = ["/css/", "/js/", "/img/", "/fonts/", "/libs/"];
const LANDING_ROOT_FILES = new Set(["/main-short.css", "/media-short.css", "/Frame"]);

function brandFromReferer(rawReferer: string | null): HostBrand | null {
  if (!rawReferer) return null;
  try {
    const ref = new URL(rawReferer);
    const p = ref.pathname.toLowerCase();
    if (p === "/irem" || p.startsWith("/irem/")) return "irem";
    if (p === "/reboot" || p.startsWith("/reboot/")) return "short";
  } catch {
    return null;
  }
  return null;
}

function resolveRequestBrand(req: NextRequest): HostBrand | null {
  const byReferer = brandFromReferer(req.headers.get("referer"));
  if (byReferer) return byReferer;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return hostBrandFromHost(host);
}

function rewriteLanding(req: NextRequest, landingPath: string) {
  const brand = resolveRequestBrand(req);
  if (!brand) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${brand}${landingPath}`;
  return NextResponse.rewrite(url);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Backend/runtime routes should stay untouched.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/pay/return") ||
    pathname.startsWith("/short/") ||
    pathname.startsWith("/irem/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Local convenience routes to open both landings by path:
  // - /reboot -> /short/index.html
  // - /irem   -> /irem/index.html
  if (pathname === "/reboot" || pathname === "/reboot/") {
    const url = req.nextUrl.clone();
    url.pathname = "/short/index.html";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/irem" || pathname === "/irem/") {
    const url = req.nextUrl.clone();
    url.pathname = "/irem/index.html";
    return NextResponse.rewrite(url);
  }

  const mappedPage = ROOT_PAGE_MAP[pathname];
  if (mappedPage) {
    return rewriteLanding(req, mappedPage);
  }

  if (LANDING_ASSET_PREFIXES.some((p) => pathname.startsWith(p))) {
    return rewriteLanding(req, pathname);
  }

  if (LANDING_ROOT_FILES.has(pathname)) {
    return rewriteLanding(req, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sitemap.xml|robots.txt).*)"],
};
