"use client";

/**
 * The two ways in, in the order that matches who is standing at the door.
 *
 * Email is first because it is the one that always works: entitlement is linked
 * by verified email, so the address on the receipt is the address that owns the
 * course, and for anyone whose mail is not Google it was previously not a way
 * in at all. Google stays right below it, one tap, for the people who already
 * have an account made that way — which today is all of them.
 */

import type { ReactNode } from "react";

import styles from "@/components/platform/PlatformSurfaceStyles";
import { EmailSignIn } from "./EmailSignIn";

export function SignInOptions({
  googleLabel,
  onGoogle,
  onSignedIn,
  footer,
}: {
  googleLabel: string;
  onGoogle: () => void;
  onSignedIn?: () => void;
  /** Whatever the host surface wants beneath the options — usually a way back. */
  footer?: ReactNode;
}) {
  return (
    <div className={styles.form}>
      <EmailSignIn onSignedIn={onSignedIn} />
      {/* A separator that is a word rather than a rule: the surface already
          carries the panel's own borders, and one more line here reads as a
          division between two forms instead of a choice between two doors. */}
      <p className={styles.status} style={{ textAlign: "center" }}>
        або
      </p>
      <button className={styles.secondaryButton} type="button" onClick={onGoogle}>
        {googleLabel}
      </button>
      {footer}
    </div>
  );
}
