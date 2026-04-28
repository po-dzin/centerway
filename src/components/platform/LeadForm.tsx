"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./PlatformStyles";

type LeadFormProps = {
  source?: string;
  productCode?: string;
  ctaPlace?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

function eventId() {
  return `lead_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
  };
}

export function LeadForm({
  source = "platform_consult_form",
  productCode = "consult",
  ctaPlace = "consultation_form",
}: LeadFormProps) {
  const [state, setState] = useState<SubmitState>("idle");
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
      interest: String(data.get("interest") ?? ""),
      message: String(data.get("message") ?? ""),
      product_code: productCode,
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

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label htmlFor="lead-name">Ваше ім&apos;я</label>
        <input id="lead-name" name="name" autoComplete="name" required />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-phone">Номер телефону</label>
        <input id="lead-phone" name="phone" autoComplete="tel" inputMode="tel" required />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-email">Email</label>
        <input id="lead-email" name="email" autoComplete="email" inputMode="email" />
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-interest">Що цікавить</label>
        <select id="lead-interest" name="interest" defaultValue="consultation">
          <option value="consultation">Особиста консультація</option>
          <option value="detox">Детокс / Шлях 21</option>
          <option value="ideal-body">Ідеальне тіло з Аюрведою</option>
          <option value="irem">Відновлююча гімнастика</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="lead-message">Коментар</label>
        <textarea id="lead-message" name="message" />
      </div>
      <button className={styles.primaryButton} type="submit" disabled={state === "submitting" || state === "success"}>
        {submitLabel}
      </button>
      <p className={`${styles.status} ${state === "success" ? styles.success : ""} ${state === "error" ? styles.error : ""}`}>
        {message}
      </p>
    </form>
  );
}
