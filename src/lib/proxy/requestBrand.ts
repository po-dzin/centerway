import type { NextRequest } from "next/server";
import { type HostBrand, hostBrandFromHost } from "@/lib/hostBrand";
import { getProductKeyByAlias } from "@/lib/surfaces/catalog";

function normalizedHost(rawHost: string | null): string {
  if (!rawHost) return "";
  return rawHost.split(":")[0].trim().toLowerCase();
}

function isPlatformRootRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/programs" ||
    pathname === "/products" ||
    pathname === "/expert" ||
    pathname === "/dosha-test"
  );
}

function brandFromReferer(rawReferer: string | null, requestHost: string, requestPathname: string): HostBrand | null {
  if (isPlatformRootRoute(requestPathname)) {
    return null;
  }
  if (!rawReferer) return null;
  try {
    const ref = new URL(rawReferer);
    // Trust referer hints only when it comes from the same host.
    if (normalizedHost(ref.host) !== requestHost) {
      return null;
    }
    const pathname = ref.pathname.toLowerCase();
    if (pathname === "/irem" || pathname.startsWith("/irem/")) return "irem";
    if (pathname === "/short" || pathname.startsWith("/short/")) return "reboot";
    if (pathname === "/reboot" || pathname.startsWith("/reboot/")) return "reboot";
    if (pathname === "/programs/reboot" || pathname.startsWith("/programs/reboot/")) return "reboot";
    if (pathname === "/programs/irem" || pathname.startsWith("/programs/irem/")) return "irem";
    if (pathname === "/programs/mini-detox" || pathname.startsWith("/programs/mini-detox/")) return "reset-day";
    if (pathname === "/mini-detox" || pathname.startsWith("/mini-detox/")) return "reset-day";
    if (pathname === "/programs/way21" || pathname.startsWith("/programs/way21/")) return "way21";
    if (pathname === "/programs/detox" || pathname.startsWith("/programs/detox/")) return "way21";
    if (pathname === "/products/herbs" || pathname.startsWith("/products/herbs/")) return "herbs";
    if (pathname === "/consult" || pathname.startsWith("/consult/")) return "consult";
    if (pathname === "/detox" || pathname.startsWith("/detox/")) return "way21";
    if (pathname === "/dosha" || pathname.startsWith("/dosha/")) return "dosha";
    if (pathname === "/dosha-test" || pathname.startsWith("/dosha-test/")) return "dosha";
    if (pathname === "/herbs" || pathname.startsWith("/herbs/")) return "herbs";
  } catch {
    return null;
  }
  return null;
}

export function resolveRequestBrand(req: NextRequest): HostBrand | null {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const requestHost = normalizedHost(host);

  // Host is the primary brand source.
  const byHost = hostBrandFromHost(requestHost);
  if (byHost) return byHost;

  // Referer acts only as a same-host fallback hint in ambiguous non-platform cases.
  return brandFromReferer(req.headers.get("referer"), requestHost, req.nextUrl.pathname.toLowerCase());
}

export function resolveRequestBrandFromPath(pathname: string): HostBrand | null {
  const clean = pathname.trim().toLowerCase();
  if (clean === "/programs/reboot" || clean.startsWith("/programs/reboot/")) return "reboot";
  if (clean === "/reboot" || clean.startsWith("/reboot/")) return "reboot";
  if (clean === "/programs/irem" || clean.startsWith("/programs/irem/")) return "irem";
  if (clean === "/irem" || clean.startsWith("/irem/")) return "irem";
  if (clean === "/programs/mini-detox" || clean.startsWith("/programs/mini-detox/")) return "reset-day";
  if (clean === "/mini-detox" || clean.startsWith("/mini-detox/")) return "reset-day";
  if (clean === "/programs/way21" || clean.startsWith("/programs/way21/")) return "way21";
  if (clean === "/programs/detox" || clean.startsWith("/programs/detox/")) return "way21";
  if (clean === "/products/herbs" || clean.startsWith("/products/herbs/")) return "herbs";
  if (clean === "/detox" || clean.startsWith("/detox/")) return "way21";
  if (clean === "/dosha" || clean.startsWith("/dosha/")) return "dosha";
  if (clean === "/dosha-test" || clean.startsWith("/dosha-test/")) return "dosha";
  if (clean === "/consult" || clean.startsWith("/consult/")) return "consult";
  if (clean === "/herbs" || clean.startsWith("/herbs/")) return "herbs";
  return getProductKeyByAlias(clean.replace(/^\//, ""));
}
