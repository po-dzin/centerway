"use client";

/**
 * A choice of doors, and no fields until one is chosen.
 *
 * THE FIRST SCREEN ASKS ONE QUESTION: which way in. It carries no input at
 * all — the address field belongs to the email door, not to the hallway in
 * front of it. Every current top-tier sign-in is built this way (Linear,
 * Vercel and Notion all open on a list of methods and nothing else); the
 * screens that still show Google beside a live email field read as a form to
 * fill in rather than a choice to make, and that is the pile this replaces.
 *
 * Google leads because it is one tap and because every account that exists
 * today was made that way. Email is the one that always works — entitlement is
 * linked by verified email, so the address on the receipt is the address that
 * owns the course — and it is a real address of its own, `/signin/email`, not
 * a panel that swaps its contents: a URL survives a reload, can be linked
 * straight from the receipt, and gives the code step a screen to live on.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HandGraphic } from "@/components/Icon";
import styles from "@/components/platform/PlatformSurfaceStyles";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { SIGNIN_PATH_PREFIX } from "@/lib/surfaces/catalog";

const copy = {
  or: "АБО",
  email: "Увійти через пошту",
} as const;

/* Google's own mark, not a stand-in for it: the multicolour "G" is what says
   which account this is before a single word is read — which is why the label
   beside it is just «Увійти» and not the provider's name a second time. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.82.95 4.05z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function SignInOptions({
  googleLabel,
  onGoogle,
}: {
  googleLabel: string;
  onGoogle: () => void;
}) {
  /* WHERE TO COME BACK TO. The wall renders in front of whichever page was
     asked for — the shelf, a lesson, the cabinet — and the door has to return
     the person there rather than to a default. The address is read here, on
     the surface that still knows it, and carried as `next`. */
  const pathname = usePathname();
  const href = useSurfaceHref();
  const emailHref = href(
    `${SIGNIN_PATH_PREFIX}/email${pathname ? `?next=${encodeURIComponent(pathname)}` : ""}`,
  );

  return (
    <div className={styles.form}>
      <button
        className={styles.primaryButton}
        type="button"
        onClick={onGoogle}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}
      >
        <GoogleGlyph />
        {googleLabel}
      </button>
      {/* Two drawn strokes and a word, not a hairline: a border across the
          panel would read as the edge of a cell, and this is a pause between
          two choices. The mark is `ink-rule`, the system's own drawn rule —
          geometry in icon-glyphs.mjs, weight in `.signInOr*`. */}
      <p className={`${styles.status} ${styles.signInOr}`}>
        <HandGraphic className={styles.signInOrMark} name="ink-rule" size={36} />
        <span>{copy.or}</span>
        <HandGraphic className={styles.signInOrMark} name="ink-rule" size={36} />
      </p>
      <Link className={styles.secondaryButton} href={emailHref}>
        {copy.email}
      </Link>
    </div>
  );
}
