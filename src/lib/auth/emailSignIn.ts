/**
 * Email sign-in, as logic — no React, no Supabase client, nothing to mock.
 *
 * WHY THIS DOOR EXISTS AT ALL. Entitlement is linked to an account by VERIFIED
 * email: `findCustomerIds` in `lib/lms/server.ts` matches a paid `customers`
 * row to a person only when the provider confirmed the address they signed in
 * with. Until now the only provider was Google, so a buyer who paid with an
 * ukr.net, i.ua or iCloud address did not "sign in to the wrong account" — they
 * could not sign in as that identity AT ALL, and their course was unreachable
 * by any self-service route. The receipt tells them which address owns the
 * purchase and, before this, offered no way to use it.
 *
 * A verified email is a verified email whichever provider vouched for it:
 * Supabase sets `email_confirmed_at` after a one-time code just as it does
 * after OAuth, so nothing downstream needs to change for the link to happen.
 *
 * A CODE, NOT A MAGIC LINK, and the difference decides whether this works for
 * the traffic it is built for. Paid social arrives inside the Instagram and
 * Facebook in-app browsers. A magic link opens in the SYSTEM browser, so the
 * session lands in a different browser from the one the person is standing in;
 * they return to the in-app tab still signed out, having done everything right.
 * A code is read in the mail app and typed into the tab that is already open,
 * which also works when the mail is on another device entirely.
 */

/** How many digits Supabase's `{{ .Token }}` carries. */
export const OTP_CODE_LENGTH = 6;

/**
 * Trim and lowercase, or reject.
 *
 * Deliberately permissive about SHAPE — a single `@` with something either
 * side. Address syntax is famously not a regex, the address is about to be
 * proved by delivery anyway, and every rule stricter than this eventually
 * turns away somebody's real mailbox.
 */
export function normalizeSignInEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (/\s/.test(email)) return null;

  const at = email.indexOf("@");
  if (at < 1) return null;
  if (at !== email.lastIndexOf("@")) return null;
  if (at === email.length - 1) return null;

  const domain = email.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return null;

  return email;
}

/**
 * Keep the digits and nothing else.
 *
 * People paste the code with a space in the middle, or with the surrounding
 * words when they copy a line out of the email. Stripping is kinder than
 * refusing, and there is nothing to be strict about: a wrong code fails at the
 * server regardless.
 */
export function normalizeOtpCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
}

export function isCompleteOtpCode(code: string): boolean {
  return code.length === OTP_CODE_LENGTH;
}

export type SignInFailure =
  | "unavailable"
  | "rate_limited"
  | "invalid_code"
  | "expired_code"
  | "invalid_email"
  | "unknown";

/**
 * Read what Supabase actually said.
 *
 * `status` is checked before the text because 429 is stable and wording is not;
 * the string matching below is a best effort over messages that change between
 * releases, which is why the fallback is a real branch and not an afterthought.
 */
export function classifySignInError(error: { message?: string; status?: number } | null): SignInFailure | null {
  if (!error) return null;

  const message = (error.message ?? "").toLowerCase();
  if (message === "auth_unavailable") return "unavailable";
  if (error.status === 429 || message.includes("rate limit") || message.includes("only request this after")) {
    return "rate_limited";
  }
  if (message.includes("expired")) return "expired_code";
  if (message.includes("invalid") && (message.includes("token") || message.includes("otp") || message.includes("code"))) {
    return "invalid_code";
  }
  if (message.includes("email") && (message.includes("invalid") || message.includes("valid"))) {
    return "invalid_email";
  }
  /* "Signups not allowed for otp" — reachable only if someone turns off email
     signups in the Supabase dashboard while this form is live. It is not the
     visitor's mistake and there is nothing for them to correct, so it falls
     through to the generic message rather than accusing them of anything. */
  return "unknown";
}
