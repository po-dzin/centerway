"use client";

import { FormEvent, useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { useOptionalToast } from "@/components/ToastProvider";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import type { SubscribePlacement } from "@/lib/broadcasts/subscribe";
import styles from "./SubscribeForm.module.css";

/**
 * THE WAY ONTO THE LIST — one email field, one box ticked by hand, one button.
 *
 * Preflight (AGENTS.md), 2026-10-03:
 *   surface          platform hub chrome (the storefront footer on `www`).
 *   semantic_role    care — staying in touch without buying anything.
 *   user_question    «Як мені дізнаватися про нове, не стежачи за сайтом?»
 *   token_source     global app DS delivery tokens (`--cw-*`, `--ds-*`); the
 *                    field, status line, checkbox and button are COMPOSED from
 *                    their existing recipes, nothing is restated.
 *   content_source   new product copy — a DRAFT awaiting the owner's approval.
 *   route_boundary   platform route; posts to `/api/subscribe` on the same host.
 *   selection_family email field and checkbox box `contour`; button `contour`
 *                    (role `secondary`, `compact` — a form row, not the page's
 *                    one action, and never gold: nothing here moves money);
 *                    the policy link `ink` (link rule, in running copy).
 *
 * WHERE EACH RESULT IS SAID. Success replaces the form: being on the list is a
 * state of this block, not a passing event, and a form left standing after
 * «готово» invites a second press. A refusal the person can fix (the address,
 * the box) stays beside the field. A failure they cannot fix — the server, the
 * network, the limiter — leaves through the toast viewport, like every other
 * transient result on the platform; without a provider it falls back to the
 * same status line.
 *
 * Copy speaks the platform layer's voice (docs/platform-copy-voice-2026-09-23.md):
 * «ви», calm, no promise of what the letters will do for anyone.
 */

const COPY = {
  title: "Листи від CenterWay",
  lead: "Новини платформи, анонси програм і матеріали про цілісний підхід до здоров’я. Пишемо нечасто, а відписатися можна з будь-якого листа.",
  emailLabel: "Email",
  consentBefore: "Погоджуюся отримувати листи від CenterWay відповідно до ",
  consentLink: "політики конфіденційності",
  consentAfter: ".",
  submit: "Підписатися",
  submitting: "Надсилаємо…",
  success: "Дякуємо, ви підписалися. Перший лист прийде з найближчою розсилкою.",
  errors: {
    consent_required: "Позначте згоду, щоб підписатися.",
    email_invalid: "Перевірте адресу — здається, в ній помилка.",
    rate_limited: "Забагато спроб поспіль. Спробуйте ще раз за кілька хвилин.",
    failed: "Не вдалося підписатися. Спробуйте ще раз трохи пізніше.",
  },
} as const;

type State = "idle" | "submitting" | "success";

export function SubscribeForm({ placement, privacyHref }: { placement: SubscribePlacement; privacyHref: string }) {
  const id = useId();
  const toast = useOptionalToast();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  function fail(text: string, contextual: boolean) {
    setState("idle");
    if (contextual || !toast) setMessage(text);
    else toast.error(text);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          consent: data.get("consent") === "on",
          source: placement,
          company: String(data.get("company") ?? ""),
        }),
      });
      if (res.ok) {
        setState("success");
        return;
      }
      const code = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
      if (code === "consent_required" || code === "email_invalid") return fail(COPY.errors[code], true);
      fail(res.status === 429 ? COPY.errors.rate_limited : COPY.errors.failed, false);
    } catch {
      fail(COPY.errors.failed, false);
    }
  }

  return (
    <section className={styles.subscribe} aria-labelledby={`${id}-title`}>
      <div className={styles.copy}>
        <p className={styles.title} id={`${id}-title`}>
          {COPY.title}
        </p>
        <p className={styles.lead}>{COPY.lead}</p>
      </div>

      {state === "success" ? (
        <p className={`${styles.status} ${styles.success}`} role="status">
          {COPY.success}
        </p>
      ) : (
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label htmlFor={`${id}-email`}>{COPY.emailLabel}</label>
            {/* The email row of the keyboard contract (docs/design-system.md →
                «Fields on a phone»). `send`, not `next`: this is the last
                field, and return submits the form. */}
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              maxLength={254}
              required
              aria-describedby={`${id}-status`}
            />
          </div>

          {/* Never pre-ticked: consent is the person's act, not a default. */}
          <label className={styles.consent}>
            <input type="checkbox" name="consent" required />
            <span className={styles.checkbox} aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            <span className={styles.consentText}>
              {COPY.consentBefore}
              <a className={styles.policyLink} href={privacyHref} data-cw-ink-control>
                <InteractionInkLabel variant="link">{COPY.consentLink}</InteractionInkLabel>
              </a>
              {COPY.consentAfter}
            </span>
          </label>

          {/* The honeypot. Off-screen rather than `display: none`, which some
              form-fillers skip; out of the tab order and the accessibility tree,
              so no person meets it. */}
          <div className={styles.trap} aria-hidden="true">
            <label htmlFor={`${id}-company`}>Компанія</label>
            <input id={`${id}-company`} name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className={styles.actions}>
            <button className={styles.submitButton} type="submit" disabled={state === "submitting"}>
              {state === "submitting" ? COPY.submitting : COPY.submit}
            </button>
          </div>

          <p className={`${styles.status} ${message ? styles.error : ""}`} id={`${id}-status`} role="alert">
            {message}
          </p>
        </form>
      )}
    </section>
  );
}
