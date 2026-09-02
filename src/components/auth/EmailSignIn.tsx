"use client";

/**
 * Sign in with the address you paid with.
 *
 * The reasoning for the whole door, and for a typed code rather than a magic
 * link, is in `@/lib/auth/emailSignIn` next to the logic this only renders.
 *
 * Two steps in one component on purpose. Sending the code and typing it back
 * are one act to the person doing it, and splitting them across a redirect or a
 * second screen is what loses people mid-flow — the address they just typed has
 * to still be on screen when they are asked for the code, or they cannot tell
 * whether they mistyped it.
 */

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import styles from "@/components/platform/PlatformSurfaceStyles";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  OTP_CODE_LENGTH,
  classifySignInError,
  isCompleteOtpCode,
  normalizeOtpCode,
  normalizeSignInEmail,
  type SignInFailure,
} from "@/lib/auth/emailSignIn";

/** Seconds before the code can be asked for again. */
const RESEND_COOLDOWN_SECONDS = 60;

const copy = {
  emailLabel: "Електронна пошта",
  emailHint: "Та сама адреса, яку ви вказали під час оплати.",
  send: "Надіслати код",
  sending: "Надсилаємо...",
  codeLabel: `Код із листа (${OTP_CODE_LENGTH} цифр)`,
  codeSentTo: (email: string) => `Ми надіслали код на ${email}. Лист іде до хвилини.`,
  verify: "Увійти",
  verifying: "Перевіряємо...",
  resend: "Надіслати код ще раз",
  resendIn: (seconds: number) => `Надіслати ще раз можна через ${seconds} с`,
  changeEmail: "Змінити адресу",
  checkSpam: "Не бачите листа — перевірте теку зі спамом.",
} as const;

const failureCopy: Record<SignInFailure, string> = {
  unavailable: "Вхід тимчасово недоступний. Напишіть нам, і ми відкриємо доступ вручну.",
  rate_limited: "Забагато спроб поспіль. Зачекайте хвилину і спробуйте ще раз.",
  invalid_code: "Код не підійшов. Перевірте цифри або надішліть новий.",
  expired_code: "Термін дії коду минув. Надішліть новий.",
  invalid_email: "Перевірте адресу — здається, у ній помилка.",
  unknown: "Не вдалося увійти. Спробуйте ще раз або напишіть нам у підтримку.",
};

const INVALID_EMAIL_MESSAGE = failureCopy.invalid_email;

type Step = "email" | "code";

export function EmailSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /* Focus follows the step, because on a phone the code arrives while this tab
     is in the background and the person comes back to it expecting to type. */
  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  const sendCode = useCallback(
    async (address: string) => {
      setBusy(true);
      setError(null);

      const { error: sendError } = await supabaseClient.auth.signInWithOtp({
        email: address,
        options: {
          /* A buyer who has never signed in HAS no account yet — the purchase
             was made against an email, not an account. Refusing to create one
             here would turn the fix back into the wall it replaces. */
          shouldCreateUser: true,
          /* Only used if the mail template also carries a link. The code is the
             path this screen supports; this keeps a clicked link from landing
             somewhere unrelated. */
          emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined,
        },
      });

      setBusy(false);

      const failure = classifySignInError(sendError);
      if (failure) {
        setError(failureCopy[failure]);
        return false;
      }

      setStep("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    },
    []
  );

  const onSubmitEmail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const address = normalizeSignInEmail(email);
      if (!address) {
        setError(INVALID_EMAIL_MESSAGE);
        return;
      }
      setEmail(address);
      await sendCode(address);
    },
    [email, sendCode]
  );

  const onSubmitCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const address = normalizeSignInEmail(email);
      if (!address || !isCompleteOtpCode(code)) return;

      setBusy(true);
      setError(null);

      const { error: verifyError } = await supabaseClient.auth.verifyOtp({
        email: address,
        token: code,
        type: "email",
      });

      setBusy(false);

      const failure = classifySignInError(verifyError);
      if (failure) {
        setError(failureCopy[failure]);
        setCode("");
        codeInputRef.current?.focus();
        return;
      }

      /* Nothing else to do here. `onAuthStateChange` carries SIGNED_IN to every
         shell already subscribed to it, and the gate around this component
         re-renders into the page the person was trying to reach. */
      onSignedIn?.();
    },
    [code, email, onSignedIn]
  );

  if (step === "code") {
    return (
      <form className={styles.form} onSubmit={onSubmitCode} noValidate>
        <p className={styles.status}>{copy.codeSentTo(email)}</p>

        <div className={styles.field}>
          <label htmlFor="cw-signin-code">{copy.codeLabel}</label>
          {/* `one-time-code` is what lets iOS and Android offer the digits
              straight from the mail app, turning six keystrokes into one tap.
              `inputMode` picks the numeric keypad without `type="number"`,
              which would bring a spinner and strip a leading zero. */}
          <input
            id="cw-signin-code"
            ref={codeInputRef}
            name="one-time-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="go"
            maxLength={OTP_CODE_LENGTH}
            value={code}
            onChange={(event) => setCode(normalizeOtpCode(event.target.value))}
            required
          />
        </div>

        {error ? <p className={`${styles.status} ${styles.error}`}>{error}</p> : null}

        <button
          className={styles.primaryButton}
          type="submit"
          disabled={busy || !isCompleteOtpCode(code)}
        >
          {busy ? copy.verifying : copy.verify}
        </button>

        <p className={styles.status}>{copy.checkSpam}</p>

        <div className={styles.heroFooter}>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => void sendCode(email)}
          >
            {cooldown > 0 ? copy.resendIn(cooldown) : copy.resend}
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            {copy.changeEmail}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmitEmail} noValidate>
      <div className={styles.field}>
        <label htmlFor="cw-signin-email">{copy.emailLabel}</label>
        {/* `autoCapitalize="none"` matters more here than anywhere else on the
            platform: an address is the identity being matched against a paid
            order, and a phone that capitalises the first letter hands us an
            address the buyer did not type. */}
        <input
          id="cw-signin-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <p className={styles.status}>{copy.emailHint}</p>

      {error ? <p className={`${styles.status} ${styles.error}`}>{error}</p> : null}

      <button className={styles.primaryButton} type="submit" disabled={busy}>
        {busy ? copy.sending : copy.send}
      </button>
    </form>
  );
}
