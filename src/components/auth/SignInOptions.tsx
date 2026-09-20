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
 *
 * WHO WAS HERE LAST, ON TOP AND BY NAME (2026-09-20). Signing out and signing
 * back in used to be one indistinguishable tap: «Увійти» handed the browser to
 * whichever Google session was still open and that account came straight back,
 * with no question asked. Two changes, and they are opposite sides of the same
 * coin. The account that was here last is offered FIRST, named, so the common
 * case is still one tap and the person can SEE which identity it is. And the
 * plain Google row beneath it now asks Google for the chooser
 * (`prompt=select_account`), because on a browser holding one session that is
 * the only way a second account is reachable at all.
 */

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { HandGraphic } from "@/components/Icon";
import styles from "@/components/platform/PlatformSurfaceStyles";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { SIGNIN_PATH_PREFIX } from "@/lib/surfaces/catalog";
import { returnQuery, returnTargetFromHere } from "@/lib/auth/signInReturn";
import { forgetLastAccount, readLastAccount, type GoogleSignInIntent } from "@/lib/auth/lastAccount";

const copy = {
  or: "АБО",
  email: "Увійти через пошту",
  continueAs: (who: string) => `Продовжити як ${who}`,
  otherAccount: "Інший акаунт Google",
  forget: "Не мій акаунт",
} as const;

/* A DOOR THAT IS NOT THERE IS NOT OFFERED (2026-09-13). The local Supabase stack
   has no Google provider, so the button led to a raw GoTrue page — «Unsupported
   provider: provider is not enabled» — and it was the first thing anyone
   testing the admin pressed. `npm run db:local:env` writes
   NEXT_PUBLIC_AUTH_GOOGLE=off beside the local keys; production never sets it,
   so the default stays "offered". */
const googleOffered = process.env.NEXT_PUBLIC_AUTH_GOOGLE !== "off";

/* Google's own mark, not a stand-in for it: the multicolour "G" is what says
   which account this is before a single word is read — which is why the label
   beside it is just «Увійти» and not the provider's name a second time. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.82.95 4.05z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/* THE REMEMBERED ACCOUNT IS AN EXTERNAL STORE, because that is what
   `localStorage` is: the server does not have it, and the value has to be the
   same on the first client render as in the markup or the door renders one
   shape and swaps to another a frame later.
   `useSyncExternalStore` compares snapshots by identity and `readLastAccount`
   parses a fresh object on every call, so the parsed value is held and only
   dropped when «Не мій акаунт» clears it — returned straight it would re-render
   for ever. */
let lastAccountSnapshot: ReturnType<typeof readLastAccount> | undefined;
const lastAccountListeners = new Set<() => void>();

function subscribeLastAccount(listener: () => void) {
  lastAccountListeners.add(listener);
  return () => {
    lastAccountListeners.delete(listener);
  };
}

function readLastAccountSnapshot() {
  if (lastAccountSnapshot === undefined) lastAccountSnapshot = readLastAccount();
  return lastAccountSnapshot;
}

function dropLastAccount() {
  forgetLastAccount();
  lastAccountSnapshot = null;
  lastAccountListeners.forEach((listener) => listener());
}

/* The address bar, by contrast, genuinely cannot change under this screen:
   leaving it is a navigation, which unmounts it. */
const subscribeToNothing = () => () => {};
const noAccount = () => null;

const OR_RULE = (
  /* Two drawn strokes and a word, not a hairline: a border across the panel
     would read as the edge of a cell, and this is a pause between two choices.
     The mark is `ink-rule`, the system's own drawn rule — geometry in
     icon-glyphs.mjs, weight in `.signInOr*`. */
  <>
    <HandGraphic className={styles.signInOrMark} name="ink-rule" size={36} />
    <span>{copy.or}</span>
    <HandGraphic className={styles.signInOrMark} name="ink-rule" size={36} />
  </>
);

export function SignInOptions({
  googleLabel,
  onGoogle,
}: {
  googleLabel: string;
  /** The intent is the account to open at, or the instruction to ask again. */
  onGoogle: (intent?: GoogleSignInIntent) => void;
}) {
  /* WHERE TO COME BACK TO. The wall renders in front of whichever page was
     asked for — the shelf, a lesson, the cabinet — and the door has to return
     the person there rather than to a default. The address is read here, on
     the surface that still knows it, and carried as `next`. A `next` this
     surface was ITSELF opened with wins, so a destination named at the header
     survives the second hop into the email door. */
  const href = useSurfaceHref();
  const returnTarget = useSyncExternalStore(
    subscribeToNothing,
    () => returnTargetFromHere() ?? "",
    () => "",
  );
  const emailHref = href(`${SIGNIN_PATH_PREFIX}/email${returnQuery(returnTarget || null)}`);

  const last = useSyncExternalStore(subscribeLastAccount, readLastAccountSnapshot, noAccount);

  if (!googleOffered) {
    return (
      <div className={styles.form}>
        <Link className={styles.primaryButton} href={emailHref}>
          {copy.email}
        </Link>
      </div>
    );
  }

  if (last) {
    return (
      <div className={styles.form}>
        {/* ONE TAP, AND IT SAYS WHOSE. The avatar and the address are not
            decoration: they are the whole difference between «sign in» and
            «sign in as this person», which is the question a shared machine
            asks and the old door answered silently. */}
        <button
          className={`${styles.primaryButton} ${styles.signInFaceButton}`}
          type="button"
          onClick={() => onGoogle({ loginHint: last.email })}
        >
          <span className={styles.signInFace} aria-hidden="true">
            {last.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={last.avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              last.email.charAt(0).toUpperCase()
            )}
          </span>
          <span className={styles.signInFaceText}>
            <span>{copy.continueAs(last.name ?? last.email)}</span>
            {last.name ? <span className={styles.signInFaceMail}>{last.email}</span> : null}
          </span>
        </button>

        <p className={`${styles.status} ${styles.signInOr}`}>{OR_RULE}</p>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => onGoogle({ selectAccount: true })}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}
        >
          <GoogleGlyph />
          {copy.otherAccount}
        </button>
        <Link className={styles.secondaryButton} href={emailHref}>
          {copy.email}
        </Link>
        <div className={styles.signInQuietRow}>
          <button className={styles.signInQuietButton} type="button" onClick={dropLastAccount}>
            {copy.forget}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <button
        className={styles.primaryButton}
        type="button"
        /* The chooser, on a door that remembers nobody: either this browser has
           never signed in here or the reader asked to be forgotten, and in both
           cases picking the account silently is the thing being fixed. */
        onClick={() => onGoogle({ selectAccount: true })}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}
      >
        <GoogleGlyph />
        {googleLabel}
      </button>
      <p className={`${styles.status} ${styles.signInOr}`}>{OR_RULE}</p>
      <Link className={styles.secondaryButton} href={emailHref}>
        {copy.email}
      </Link>
    </div>
  );
}
