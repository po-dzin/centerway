"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { personalNav, platformNav } from "@/lib/platform/content";
import { isPersonalHost } from "@/lib/platform/surfaceHref";
import { InkMenuLabel } from "./PlatformAccountMenu";
import { useSurfaceHost, useSurfaceHref } from "./SurfaceHost";

/**
 * THE SURFACE'S ROUTE MAP, AS MENU ROWS.
 *
 * The five public destinations are the storefront's map, and for as long as the
 * phone carried a bar they were IN that bar — which is the whole reason the
 * floating islands were held back to the learner surfaces when they shipped on
 * 2026-09-05. `learn` has an empty route map by design, so two pills lost
 * nothing there; the storefront's would have lost the map.
 *
 * They are not lost by moving: a phone never showed all five at once anyway.
 * The bar showed a mark and a burger, and the five lived one tap inside it. The
 * islands show a mark and an account, and the five live one tap inside that.
 * What changes is which sheet they are in — and now there is only one sheet on
 * the phone instead of two that both opened from the top-right corner and held
 * overlapping lists.
 *
 * Same source as the bar (`platformNav` / `personalNav`), so the two cannot
 * drift; same `InkMenuLabel` as the account rows, so a destination looks like a
 * destination wherever it is read.
 */
export function PlatformRouteRows({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const href = useSurfaceHref();
  const onPersonalSurface = isPersonalHost(useSurfaceHost());
  const source = onPersonalSurface ? personalNav : platformNav;

  const isActive = (target: string, match?: "exact" | "prefix") =>
    match === "exact" ? pathname === target : Boolean(pathname?.startsWith(target));

  return (
    <>
      {source.map((item) => {
        const current = isActive(item.href, item.match);
        return (
          <Link
            key={item.href}
            href={href(item.href)}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
            data-current={current || undefined}
          >
            <InkMenuLabel active={current}>{item.label}</InkMenuLabel>
          </Link>
        );
      })}
    </>
  );
}
