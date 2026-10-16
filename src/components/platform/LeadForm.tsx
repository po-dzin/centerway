"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./PlatformSurfaceStyles";

type LeadFormProps = {
  source?: string;
  productCode?: string;
  ctaPlace?: string;
  /**
   * The author this request is to. A consultation is always with one person,
   * so a form on an author's page names them; the server checks the slug
   * against a listed author who takes consultations before it trusts it.
   */
  authorSlug?: string;
  /**
   * Starts as one button, «Залишити запит», and opens into the fields on
   * click (G, 2026-10-16: the open form was the heaviest thing on the
   * author's page). A link to `#request` — the hub's «Записатися» — arrives
   * with it already open, because that reader has already decided.
   */
  collapsed?: boolean;
};

/** The anchor a link uses to arrive at an author's request form already open. */
export const LEAD_FORM_ANCHOR = "request";

type SubmitState = "idle" | "submitting" | "success" | "error";

function eventId() {
  return `lead_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
  const value = match?.[2];
  return value ? decodeURIComponent(value) : "";
}

function paramsFromLocation() {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  return {
    page_url: window.location.href,
    referrer: document.referrer,
    utm_source: sp.get("utm_source") ?? "",
    utm_medium: sp.get("utm_medium") ?? "",
    utm_campaign: sp.get("utm_campaign") ?? "",
    utm_content: sp.get("utm_content") ?? "",
    utm_term: sp.get("utm_term") ?? "",
    fbclid: sp.get("fbclid") ?? "",
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc"),
  };
}

export function LeadForm({
  source = "platform_consult_form",
  productCode = "consult",
  ctaPlace = "consultation_form",
  authorSlug,
  collapsed = false,
}: LeadFormProps) {
  const [state, setState] = useState<SubmitState>("idle");
  const [open, setOpen] = useState(!collapsed);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!collapsed) return;
    const openOnAnchor = () => {
      if (window.location.hash === `#${LEAD_FORM_ANCHOR}`) setOpen(true);
    };
    openOnAnchor();
    window.addEventListener("hashchange", openOnAnchor);
    return () => window.removeEventListener("hashchange", openOnAnchor);
  }, [collapsed]);
  const [message, setMessage] = useState("");
  const submitLabel = useMemo(() => {
    if (state === "submitting") return "Надсилаємо...";
    if (state === "success") return "Заявку надіслано";
    return "Залишити запит";
  }, [state]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const leadEventId = eventId();
    setState("submitting");
    setMessage("");

    const body = {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      /* No «що цікавить» select any more. It asked the reader to classify their
         own request from a list of six products before they had said anything,
         and the page it sits on already knows which offer it is — `productCode`
         is sent below and is the honest answer. Anything the list could not
         express belongs in the comment, where a person can say it in their own
         words. */
      message: String(data.get("message") ?? ""),
      product_code: productCode,
      ...(authorSlug ? { author: authorSlug } : {}),
      source,
      cta_place: ctaPlace,
      event_id: leadEventId,
      ...paramsFromLocation(),
    };

    try {
      const [leadRes] = await Promise.all([
        fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: "ConsultCTA",
            event_id: `consult_${leadEventId}`,
            product: productCode,
            cta_place: ctaPlace,
            target: "consultation",
            ...paramsFromLocation(),
          }),
        }).catch(() => null),
      ]);

      if (!leadRes.ok) throw new Error("lead_failed");
      form.reset();
      setState("success");
      setMessage("Заявка прийнята, очікуйте.");
    } catch {
      setState("error");
      setMessage("Не вдалося надіслати заявку. Спробуйте ще раз або напишіть у Telegram.");
    }
  }

  if (!open) {
    return (
      <button
        className={styles.primaryButton}
        type="button"
        aria-expanded="false"
        onClick={() => {
          setOpen(true);
          /* After the fields exist: the click asked to write, so the caret
             goes where the writing starts. */
          requestAnimationFrame(() => nameRef.current?.focus());
        }}
      >
        Залишити запит
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label htmlFor="lead-name">Ваше ім&apos;я</label>
        {/* THE KEYBOARD IS PART OF THE FIELD (2026-08-28).
            Four attributes, and each answers one thing the phone would
            otherwise guess: `type` picks the keyboard AND the autofill bucket,
            `autoCapitalize` decides whether the first letter arrives shifted,
            `enterKeyHint` labels the return key, and `autoComplete` is what
            makes the browser's saved contact offerable at all. A name is the
            one field here that WANTS capitals. */}
        <input
          ref={nameRef}
          id="lead-name"
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-phone">Номер телефону</label>
        {/* `type` AND `inputMode`, which are not the same instruction. iOS
            reads `inputMode` for the keypad; `type="tel"` is what puts the
            field in the browser's phone autofill bucket, and without it a saved
            number is never offered. Neither one validates, which is correct —
            this form takes numbers in every shape a person writes them. */}
        <input
          id="lead-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="next"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-email">Email</label>
        {/* An address is never capitalised and never a word the dictionary
            knows, so all three assistants are turned off by hand: iOS shifts
            the first letter of a field by default and autocorrect has rewritten
            more than one domain into a real word on the way to the server. */}
        <input
          id="lead-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-message">Коментар</label>
        {/* No `enterKeyHint` on the comment: return means a new line here, and
            labelling it «send» would promise a submit the key does not do. */}
        <textarea id="lead-message" name="message" autoCapitalize="sentences" />
      </div>
      <button className={styles.primaryButton} type="submit" disabled={state === "submitting" || state === "success"}>
        {submitLabel}
      </button>
      <p
        className={`${styles.status} ${state === "success" ? styles.success : ""} ${state === "error" ? styles.error : ""}`}
      >
        {message}
      </p>
    </form>
  );
}
