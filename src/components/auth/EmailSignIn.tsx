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
import { useOptionalToast } from "@/components/ToastProvider";
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
  emailHint: "Та сама, що й під час оплати.",
  send: "Надіслати код",
  sending: "Надсилаємо...",
  codeLabel: `Код із листа (${OTP_CODE_LENGTH} цифр)`,
  codeSentTo: (email: string) => `Код надіслано на ${email}. Немає листа — подивіться у спамі.`,
  verifying: "Перевіряємо...",
  resend: "Надіслати ще раз",
  resendIn: (seconds: number) => `Ще раз через ${seconds} с`,
  changeEmail: "Змінити адресу",
  back: "Назад",
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

export function EmailSignIn({
  onSignedIn,
  onBack,
}: {
  onSignedIn?: () => void;
  /** The way out of this door and back to the choice of doors. */
  onBack?: () => void;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);
  /* Failures leave as notifications, not as a paragraph inside the panel. A
     line that appears between the form and its button re-lays out the card
     under the reader's thumb — the same reason every other surface on the
     platform reports results through the toast viewport. */
  const toast = useOptionalToast();
  const report = useCallback((message: string) => toast?.error(message), [toast]);

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
        report(failureCopy[failure]);
        return false;
      }

      setStep("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    },
    [report],
  );

  const onSubmitEmail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const address = normalizeSignInEmail(email);
      if (!address) {
        report(INVALID_EMAIL_MESSAGE);
        return;
      }
      setEmail(address);
      await sendCode(address);
    },
    [email, report, sendCode],
  );

  const verify = useCallback(
    async (token: string) => {
      const address = normalizeSignInEmail(email);
      if (!address || !isCompleteOtpCode(token)) return;

      setBusy(true);

      const { error: verifyError } = await supabaseClient.auth.verifyOtp({
        email: address,
        token,
        type: "email",
      });

      setBusy(false);

      const failure = classifySignInError(verifyError);
      if (failure) {
        report(failureCopy[failure]);
        setCode("");
        codeInputRef.current?.focus();
        return;
      }

      /* Nothing else to do here. `onAuthStateChange` carries SIGNED_IN to every
         shell already subscribed to it, and the gate around this component
         re-renders into the page the person was trying to reach. */
      onSignedIn?.();
    },
    [email, onSignedIn, report],
  );

  /* THE SIXTH DIGIT IS THE SUBMIT. There is nothing left to decide once the
     code is complete — a button under it only asks the person to confirm that
     they meant the digits they just typed, and on a phone that button sits
     under the keyboard that typed them. This runs on the change that completes
     the code, autofill included, and not from an effect watching the value:
     the typing IS the submit event. */
  const onChangeCode = useCallback(
    (value: string) => {
      const next = normalizeOtpCode(value);
      setCode(next);
      if (!busy && isCompleteOtpCode(next)) void verify(next);
    },
    [busy, verify],
  );

  if (step === "code") {
    return (
      <form className={styles.form} onSubmit={(event) => event.preventDefault()} noValidate>
        <p className={styles.status}>{busy ? copy.verifying : copy.codeSentTo(email)}</p>

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
            disabled={busy}
            onChange={(event) => onChangeCode(event.target.value)}
            required
          />
        </div>

        <div className={styles.signInQuietRow}>
          <button
            className={styles.signInQuietButton}
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => void sendCode(email)}
          >
            {cooldown > 0 ? copy.resendIn(cooldown) : copy.resend}
          </button>
          <button
            className={styles.signInQuietButton}
            type="button"
            disabled={busy}
            onClick={() => {
              setStep("email");
              setCode("");
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

      {/* Primary here, unlike on the choice screen: this step is a screen of
          its own now, and the only thing on it to do. */}
      <button className={styles.primaryButton} type="submit" disabled={busy}>
        {busy ? copy.sending : copy.send}
      </button>

      {onBack ? (
        <div className={styles.signInQuietRow}>
          <button className={styles.signInQuietButton} type="button" onClick={onBack}>
            {copy.back}
          </button>
        </div>
      ) : null}
    </form>
  );
}
