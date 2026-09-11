"use client";

/**
 * A link that navigates as one movement.
 *
 * Everything `next/link` is, plus the transition — same props, same prefetch,
 * same markup, so swapping it in at a call site changes how the trip is drawn
 * and nothing else. It forwards its ref, which is not optional here: the
 * reader's pager drives the arrow keys by focusing these links directly.
 *
 * WHAT IT REFUSES TO INTERCEPT, and why each one matters:
 *
 *   - a click carrying a modifier, or the middle button. Cmd-click means «open
 *     this somewhere else»; taking it over would turn a new tab into a
 *     navigation, which is the kind of theft that makes people stop trusting
 *     links.
 *   - a link with a `target`. Same reason, stated by the markup instead of by
 *     the hand.
 *   - a click something else has already handled. If a parent called
 *     `preventDefault`, this is not a navigation any more.
 *   - anything that is not a plain internal path. An absolute URL leaves the
 *     app, and there is no next frame here to transition to.
 *
 * In every one of those cases the event is left exactly as it arrived and
 * `next/link` does what it has always done.
 */

import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { navigateAsOneMovement } from "./routeTransition";

type MotionLinkProps = ComponentPropsWithoutRef<typeof Link>;

export const MotionLink = forwardRef<HTMLAnchorElement, MotionLinkProps>(function MotionLink(
  { href, onClick, target, ...rest },
  ref,
) {
  const router = useRouter();

  return (
    <Link
      {...rest}
      href={href}
      target={target}
      ref={ref}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (target && target !== "_self") return;

        const to = typeof href === "string" ? href : null;
        if (!to || !to.startsWith("/")) return;

        event.preventDefault();
        navigateAsOneMovement(() => router.push(to));
      }}
    />
  );
});
