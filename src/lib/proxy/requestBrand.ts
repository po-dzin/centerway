import type { NextRequest } from "next/server";
import { type HostBrand, hostBrandFromHost } from "@/lib/hostBrand";

function normalizedHost(rawHost: string | null): string {
  if (!rawHost) return "";
  return rawHost.split(":")[0].trim().toLowerCase();
}

function brandFromReferer(rawReferer: string | null, requestHost: string): HostBrand | null {
  if (!rawReferer) return null;
  try {
    const ref = new URL(rawReferer);
    // Trust referer hints only when it comes from the same host.
    if (normalizedHost(ref.host) !== requestHost) {
      return null;
    }
    const pathname = ref.pathname.toLowerCase();
    if (pathname === "/irem" || pathname.startsWith("/irem/")) return "irem";
    if (pathname === "/reboot" || pathname.startsWith("/reboot/")) return "reboot";
    if (pathname === "/consult" || pathname.startsWith("/consult/")) return "consult";
    if (pathname === "/detox" || pathname.startsWith("/detox/")) return "detox";
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

  // Referer acts only as a same-host fallback hint in ambiguous cases.
  return brandFromReferer(req.headers.get("referer"), requestHost);
}
