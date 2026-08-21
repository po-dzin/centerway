"use client";

import { hostBrandFromHost } from "@/lib/hostBrand";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";
import { useEffect, useState, useSyncExternalStore } from "react";

/** Re-export, not a second declaration — the origin is owned by the surface
    registry so server code (bot, reminders) can read it too. */
export const PLATFORM_SITE_ORIGIN = PLATFORM_ORIGIN;

function normalizeHost(rawHost: string | null | undefined): string {
  if (!rawHost) return "";
  return rawHost.split(":")[0].trim().toLowerCase();
}

function toAbsolutePlatformHref(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${PLATFORM_SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function resolvePlatformHref(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  const host = normalizeHost(window.location.host);
  if (!hostBrandFromHost(host)) {
    return path;
  }

  return toAbsolutePlatformHref(path);
}

export function useIsBrandedHost(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => {
      const host = normalizeHost(window.location.host);
      return Boolean(hostBrandFromHost(host));
    },
    () => false
  );
}

export function usePlatformHref(path: string): string {
  const [resolvedHref, setResolvedHref] = useState(path);

  useEffect(() => {
    setResolvedHref(resolvePlatformHref(path));
  }, [path]);

  return resolvedHref;
}
