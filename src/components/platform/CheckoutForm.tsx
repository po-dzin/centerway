"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from "react";

import { LogoMark } from "@/components/brand/LogoMark";
import { normalizeBuyerName, normalizeContactPhone, readPrimaryContact } from "@/lib/platform/buyerContact";
import pendingStyles from "./CheckoutStartLink.module.css";
import styles from "./PlatformCheckout.module.css";

/* The shape `/api/pay/start` accepts (`EMAIL_SHAPE` there). Checked here only
   to answer before a round trip; the route checks again and is the authority. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* What this device typed last time, so a buyer coming back for a second
   course types nothing twice. The address keeps the key the landing step used;
   the name and the contacts sit beside it. */
const EMAIL_KEY = "cw_buyer_email";
const DETAILS_KEY = "cw_buyer_details";

type Remembered = { email: string; name: string; contact: string; whatsapp: string };

/* One frozen snapshot per page: `useSyncExternalStore` compares by identity,
   so a fresh object on every read would never settle. */
let rememberedCache: Remembered | null = null;
const NOTHING_REMEMBERED: Remembered = { email: "", name: "", contact: "", whatsapp: "" };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function remembered(): Remembered {
  if (rememberedCache) return rememberedCache;
  try {
    const details = JSON.parse(window.localStorage.getItem(DETAILS_KEY) ?? "{}") as Record<string, unknown>;
    rememberedCache = {
      email: window.localStorage.getItem(EMAIL_KEY) ?? "",
      name: text(details.name),
      contact: text(details.contact),
      whatsapp: text(details.whatsapp),
    };
  } catch {
    rememberedCache = NOTHING_REMEMBERED;
  }
  return rememberedCache;
}

/* Neither the address bar nor storage changes while this form is mounted. */
const subscribeToNothing = () => () => {};

function remember(email: string | null, details: { name: string; contact: string; whatsapp: string }) {
  try {
    if (email) window.localStorage.setItem(EMAIL_KEY, email);
    window.localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
  } catch {
    /* A private window: the details still go with this order. */
  }
}

/** What the page already knows: fields sent back by the route, or the signed-in buyer's own row. */
export type CheckoutInitial = {
  email: string | null;
  name: string | null;
  contact: string | null;
  whatsapp: string | null;
};

type FieldName = "name" | "email" | "contact" | "whatsapp";

/**
 * Who is paying, and the button that leaves for the gateway.
 *
 * A PLAIN GET FORM to `/api/pay/start`, so it works before (and without) this
 * component's JavaScript: the browser's own `required`/`type="email"` checks
 * and the route's redirect back here do the whole job. The script adds three
 * things on top — remembered details, messages in our words instead of the
 * browser's, and the waiting state `CheckoutStartLink` gives every other buy
 * button, including its guard against the second tap that used to raise a
 * second invoice.
 *
 * WHAT IS ASKED (owner, 2026-10-14): a name, the address access and the
 * receipt go to, and «Телефон або Telegram» — one required field, whichever
 * the buyer types — for when an email is not enough. WhatsApp is optional,
 * below it. No either-or buttons: the buyer types, the field decides. SIGNED IN, THE ADDRESS IS NOT ASKED: the session's is
 * verified, and the route uses it when the form carries none. «Інша адреса»
 * opens the field for a gift; what is typed there wins, exactly as the route
 * already decides.
 */
export function CheckoutForm({
  fields,
  accountEmail,
  initial,
}: {
  fields: [string, string][];
  accountEmail: string | null;
  initial: CheckoutInitial;
}) {
  const [useAccount, setUseAccount] = useState(accountEmail !== null && !initial.email);
  /* Null until the buyer types: until then each field shows what the page
     knows, else what this device remembers. Storage is read as an external
     store, so the server render (no storage) and the first client render agree
     without an effect. */
  const stored = useSyncExternalStore(subscribeToNothing, remembered, () => NOTHING_REMEMBERED);
  const [typedName, setName] = useState<string | null>(null);
  const [typedEmail, setEmail] = useState<string | null>(null);
  const [typedContact, setContact] = useState<string | null>(null);
  const [typedWhatsapp, setWhatsapp] = useState<string | null>(null);
  const name = typedName ?? initial.name ?? stored.name;
  const email = typedEmail ?? initial.email ?? stored.email;
  const contact = typedContact ?? initial.contact ?? stored.contact;
  const whatsapp = typedWhatsapp ?? initial.whatsapp ?? stored.whatsapp;

  const [errors, setErrors] = useState<Partial<Record<FieldName, boolean>>>({});
  const [pending, setPending] = useState(false);
  /* The browser checks the fields until this script is running; after that the
     checks below do, in our words rather than the browser's. */
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);

  /* COMING BACK MUST NOT FIND IT STILL WAITING — the back button restores this
     page from the bfcache with React state intact (see CheckoutStartLink). */
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const clearError = (field: FieldName) =>
    setErrors((current) => (current[field] ? { ...current, [field]: false } : current));

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (pending) {
        event.preventDefault();
        return;
      }
      const typed = email.trim().toLowerCase();
      const found: Partial<Record<FieldName, boolean>> = {
        name: !normalizeBuyerName(name),
        email: !useAccount && !EMAIL_SHAPE.test(typed),
        contact: !readPrimaryContact(contact),
        // Optional, so only a typed number that is not one is wrong.
        whatsapp: whatsapp.trim() !== "" && !normalizeContactPhone(whatsapp),
      };
      if (found.name || found.email || found.contact || found.whatsapp) {
        event.preventDefault();
        setErrors(found);
        // The first wrong field, in reading order.
        (found.name ? nameRef : found.email ? emailRef : found.contact ? contactRef : whatsappRef).current?.focus();
        return;
      }
      remember(useAccount ? null : typed, { name: name.trim(), contact: contact.trim(), whatsapp: whatsapp.trim() });
      setPending(true);
    },
    [contact, email, name, pending, useAccount, whatsapp],
  );

  const otherAddress = useCallback(() => {
    setUseAccount(false);
    // After the field renders, not before: there is nothing to focus yet.
    window.requestAnimationFrame(() => emailRef.current?.focus());
  }, []);

  return (
    <form className={styles.form} action="/api/pay/start" method="get" onSubmit={onSubmit} noValidate={hydrated}>
      {fields.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

      <div className={styles.field}>
        <label htmlFor="cw-checkout-name">Ім&apos;я</label>
        <input
          id="cw-checkout-name"
          ref={nameRef}
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={80}
          placeholder="Анна"
          value={name}
          aria-invalid={errors.name || undefined}
          aria-describedby={errors.name ? "cw-checkout-name-error" : undefined}
          onChange={(event) => {
            setName(event.target.value);
            clearError("name");
          }}
          required
        />
        {errors.name ? (
          <p id="cw-checkout-name-error" className={styles.fieldError} role="alert">
            Напишіть, як до вас звертатися
          </p>
        ) : null}
      </div>

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
            ref={emailRef}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="anna@gmail.com"
            value={email}
            aria-invalid={errors.email || undefined}
            aria-describedby="cw-checkout-email-note"
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            required
          />
          <p
            id="cw-checkout-email-note"
            className={errors.email ? styles.fieldError : styles.fieldNote}
            role={errors.email ? "alert" : undefined}
          >
            {errors.email
              ? "Введіть адресу у форматі anna@gmail.com"
              : "На неї прийдуть чек і вхід у кабінет. Перевірте літери."}
          </p>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="cw-checkout-contact">Телефон або Telegram</label>
        {/* `type="text"`, not `tel`: a Telegram username has letters, and a
            phone keypad would hide them. */}
        <input
          id="cw-checkout-contact"
          ref={contactRef}
          name="contact"
          type="text"
          autoComplete="tel"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="+380 67 123 45 67 або @anna"
          value={contact}
          aria-invalid={errors.contact || undefined}
          aria-describedby="cw-checkout-contact-note"
          onChange={(event) => {
            setContact(event.target.value);
            clearError("contact");
          }}
          required
        />
        <p
          id="cw-checkout-contact-note"
          className={errors.contact ? styles.fieldError : styles.fieldNote}
          role={errors.contact ? "alert" : undefined}
        >
          {errors.contact
            ? "Введіть номер, як +380 67 123 45 67, або нік у Telegram, як @anna"
            : "Напишемо сюди, якщо щось зміниться або знадобиться допомога."}
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="cw-checkout-whatsapp">
          WhatsApp <span className={styles.optional}>(необов&apos;язково)</span>
        </label>
        <input
          id="cw-checkout-whatsapp"
          ref={whatsappRef}
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          enterKeyHint="go"
          placeholder="+380 67 123 45 67"
          value={whatsapp}
          aria-invalid={errors.whatsapp || undefined}
          aria-describedby={errors.whatsapp ? "cw-checkout-whatsapp-error" : undefined}
          onChange={(event) => {
            setWhatsapp(event.target.value);
            clearError("whatsapp");
          }}
        />
        {errors.whatsapp ? (
          <p id="cw-checkout-whatsapp-error" className={styles.fieldError} role="alert">
            Введіть номер, як +380 67 123 45 67, або залиште поле порожнім
          </p>
        ) : null}
      </div>

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
