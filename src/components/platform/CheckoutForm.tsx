"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from "react";

import { LogoMark } from "@/components/brand/LogoMark";
import pendingStyles from "./CheckoutStartLink.module.css";
import styles from "./PlatformCheckout.module.css";

/* The shape `/api/pay/start` accepts (`EMAIL_SHAPE` there). Checked here only
   to answer before a round trip; the route checks again and is the authority. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* The last address typed on this device, so a buyer coming back for a second
   course does not type it twice. The same key the landing step used. */
const STORE_KEY = "cw_buyer_email";

function remembered(): string {
  try {
    return window.localStorage.getItem(STORE_KEY) ?? "";
  } catch {
    return "";
  }
}

/* Neither the address bar nor storage changes while this form is mounted. */
const subscribeToNothing = () => () => {};

function remember(email: string) {
  try {
    window.localStorage.setItem(STORE_KEY, email);
  } catch {
    /* A private window: the address still goes with this order. */
  }
}

/**
 * The address step and the button that leaves for the gateway.
 *
 * A PLAIN GET FORM to `/api/pay/start`, so it works before (and without) this
 * component's JavaScript: the browser's own `type="email"` check and the
 * route's redirect do the whole job. The script adds three things on top — a
 * remembered address, a message in our words instead of the browser's, and the
 * waiting state `CheckoutStartLink` gives every other buy button, including
 * its guard against the second tap that used to raise a second invoice.
 *
 * SIGNED IN, NOTHING IS ASKED. The session's address is verified, and the
 * route uses it when the form carries none. «Інша адреса» opens the field for
 * a gift; what is typed there wins, exactly as the route already decides.
 */
export function CheckoutForm({ fields, accountEmail }: { fields: [string, string][]; accountEmail: string | null }) {
  const [useAccount, setUseAccount] = useState(accountEmail !== null);
  /* Null until the buyer types: until then the field shows the address this
     device remembers. Read as an external store, so the server render (no
     storage) and the first client render agree without an effect. */
  const [typedEmail, setEmail] = useState<string | null>(null);
  const rememberedEmail = useSyncExternalStore(subscribeToNothing, remembered, () => "");
  const email = typedEmail ?? rememberedEmail;
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  /* The browser checks the field until this script is running; after that the
     check below does, in our words rather than the browser's. */
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  /* COMING BACK MUST NOT FIND IT STILL WAITING — the back button restores this
     page from the bfcache with React state intact (see CheckoutStartLink). */
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (pending) {
        event.preventDefault();
        return;
      }
      if (!useAccount) {
        const typed = email.trim().toLowerCase();
        if (!EMAIL_SHAPE.test(typed)) {
          event.preventDefault();
          setError(true);
          inputRef.current?.focus();
          return;
        }
        remember(typed);
      }
      setPending(true);
    },
    [email, pending, useAccount],
  );

  const otherAddress = useCallback(() => {
    setUseAccount(false);
    // After the field renders, not before: there is nothing to focus yet.
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <form className={styles.form} action="/api/pay/start" method="get" onSubmit={onSubmit} noValidate={hydrated}>
      {fields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {useAccount && accountEmail ? (
        <div className={styles.account}>
          <p className={styles.accountLine}>
            Доступ прийде в ваш акаунт <b>{accountEmail}</b>
          </p>
          <button className={styles.quietAction} type="button" onClick={otherAddress}>
            Інша адреса
          </button>
        </div>
      ) : (
        <div className={styles.field}>
          <label htmlFor="cw-checkout-email">Електронна пошта</label>
          {/* `autoCapitalize="none"`: the address is matched against the paid
              order, and a phone that capitalises the first letter hands us an
              address the buyer did not type. */}
          <input
            id="cw-checkout-email"
            ref={inputRef}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="anna@gmail.com"
            value={email}
            aria-invalid={error || undefined}
            aria-describedby="cw-checkout-email-note"
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(false);
            }}
            required
          />
          <p
            id="cw-checkout-email-note"
            className={error ? styles.fieldError : styles.fieldNote}
            role={error ? "alert" : undefined}
          >
            {error
              ? "Введіть адресу у форматі anna@gmail.com"
              : "На неї прийдуть чек і вхід у кабінет. Перевірте літери."}
          </p>
        </div>
      )}

      <button
        className={`${styles.payAction} ${pendingStyles.control}`}
        type="submit"
        data-pending={pending ? "true" : undefined}
        aria-busy={pending || undefined}
      >
        {/* Both labels stay in the DOM so the button cannot change width at the
            moment it is pressed (CheckoutStartLink.module.css). */}
        <span className={pendingStyles.rest} aria-hidden={pending}>
          Перейти до оплати
        </span>
        <span className={pendingStyles.wait} aria-hidden={!pending}>
          <LogoMark size={20} animate="wait" aria-hidden />
          <span>Відкриваємо оплату…</span>
        </span>
      </button>
    </form>
  );
}

/**
 * «Назад» to wherever the buyer came from: a landing, the program page. With
 * no history to go back to (a link opened in a new tab), the offer's own page
 * on the platform is the honest destination.
 */
export function CheckoutBackLink({ href }: { href: string }) {
  const onClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (window.history.length > 1 && document.referrer) {
      event.preventDefault();
      window.history.back();
    }
  }, []);

  return (
    <a className={styles.back} href={href} onClick={onClick}>
      Назад
    </a>
  );
}
