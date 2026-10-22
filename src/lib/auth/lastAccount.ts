/**
 * WHO WAS SIGNED IN HERE LAST TIME.
 *
 * Signing out used to end the story: the door came back offering «Увійти» and
 * nothing else, and pressing it handed the browser straight back to whichever
 * Google session was still open — the same account, no question asked. On a
 * shared machine, or for anyone holding a personal and a working address, that
 * is not a sign-in at all; it is the product deciding who you are.
 *
 * So the door needs two things this file supplies. The name of the account
 * that was here last, to be offered FIRST and by name — that is the one tap
 * ninety-nine visits out of a hundred want — and, standing beside it, a way in
 * that deliberately asks Google again (`prompt=select_account`, see
 * `googleSignInOptions`).
 *
 * A HINT, NEVER A CREDENTIAL. What is stored is what the provider already put
 * on screen — a name, an address, an avatar URL — and nothing that could be
 * used to act as that person: no token, no id. Its only power is to pre-fill a
 * choice the identity provider still has to confirm. That is why
 * `localStorage` is honest here where it would not be for a session, and why
 * `forgetLastAccount` exists for the reader who wants the machine to stop
 * remembering.
 */

import type { Session } from "@supabase/supabase-js";

import type { ImageCrop } from "@/lib/media/imageCrop";

import { accountAvatar, accountAvatarCrop, accountName } from "./accountIdentity";

const KEY = "cw.auth.last-account";

export type LastAccount = {
  email: string;
  /** The account's name: an author's profile name, else the provider's. */
  name: string | null;
  avatar: string | null;
  /** How a chosen (profile) photo sits in the circle. */
  avatarCrop?: ImageCrop;
};

/** Writes the account a fresh session belongs to. Silent when storage is off. */
export function rememberAccount(session: Session | null): void {
  if (typeof window === "undefined") return;
  const email = session?.user?.email;
  if (!email) return;

  const account: LastAccount = {
    email,
    name: accountName(session?.user?.user_metadata),
    avatar: accountAvatar(session?.user?.user_metadata),
    ...(accountAvatarCrop(session?.user?.user_metadata)
      ? { avatarCrop: accountAvatarCrop(session?.user?.user_metadata) }
      : {}),
  };

  try {
    window.localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // Private mode, or storage disabled. The door simply forgets, which is the
    // behaviour it had before this existed.
  }
}

/** The account that was signed in here last, or null. */
export function readLastAccount(): LastAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastAccount> | null;
    if (!parsed || typeof parsed.email !== "string" || parsed.email.length === 0) return null;
    return {
      email: parsed.email,
      name: typeof parsed.name === "string" && parsed.name.length > 0 ? parsed.name : null,
      avatar: typeof parsed.avatar === "string" && parsed.avatar.length > 0 ? parsed.avatar : null,
      ...(parsed.avatarCrop && typeof parsed.avatarCrop === "object" ? { avatarCrop: parsed.avatarCrop } : {}),
    };
  } catch {
    return null;
  }
}

export function forgetLastAccount(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * What to ask Google for.
 *
 * `login_hint` names the account to open at — the «Продовжити як» row — and
 * `prompt=select_account` is the opposite instruction: show the chooser even
 * when exactly one session is open, which is the only way a second account can
 * ever be reached from a browser that has one.
 *
 * Neither is passed when the door knows nothing: a first sign-in has no account
 * to hint at, and forcing the chooser on a browser with a single session would
 * add a screen to the shortest path in the product.
 */
export type GoogleSignInIntent = { loginHint?: string; selectAccount?: boolean };

export function googleQueryParams(intent: GoogleSignInIntent | undefined): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  if (intent?.loginHint) params.login_hint = intent.loginHint;
  if (intent?.selectAccount) params.prompt = "select_account";
  return Object.keys(params).length > 0 ? params : undefined;
}
