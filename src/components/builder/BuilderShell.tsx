"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { PlatformAccountMenu } from "@/components/platform/layout/PlatformAccountMenu";
import { PlatformTrail, type TrailStep } from "@/components/platform/PlatformTrail";
import { supabaseClient } from "@/lib/supabaseClient";
import type { BuilderFailure } from "./builderClient";
import styles from "./Builder.module.css";

/**
 * The builder's chrome.
 *
 * THE HEADER ANSWERS ONE QUESTION and does not change shape per route: which
 * application is this, and how do I get back to my own courses. The mark plus
 * the word «Білдер», and the mark is a LINK to the root — the one control in
 * the same place on every screen, which is what makes it the way home rather
 * than a logo.
 *
 * IT USED TO ANSWER THREE. Brand, trail and step arrows shared one row, and the
 * wordmark had to be hidden below 561px to make them fit. A row that drops a
 * word to fit is a row carrying someone else's job, so the trail moved into the
 * page (`PlatformTrail`, shared with the learner's player) and the outline
 * moved into a rail beside it.
 *
 * THE RAIL is the course's own structure, and it is for the LESSON EDITOR only.
 * The course page IS the structure — a rail repeating it beside itself is the
 * panel-inside-a-panel the design system spent a wave removing. Below 901px the
 * same node becomes a drawer the header's button opens; one component, two
 * presentations, never two lists that can disagree.
 *
 * STATIC, NOT STICKY — deliberately, and it is the editor that decides it. The
 * save bar is the control whose absence loses work, so it gets the sticky
 * budget; two pinned layers on a phone leave a lesson about four lines tall
 * between them.
 */

export function BuilderShell({
  trail = [],
  tools,
  aside,
  asideOpen,
  children,
}: {
  trail?: TrailStep[];
  tools?: ReactNode;
  /** The course outline. A rail on desktop, a drawer below 901px. */
  aside?: ReactNode;
  asideOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link className={styles.barBrand} href="/build">
          <span className={styles.barMark} aria-hidden="true" />
          <span className={styles.barBrandName}>
            CenterWay <span className={styles.barKind}>Білдер</span>
          </span>
        </Link>
        <span className={styles.barSpacer} />
        {tools ? <div className={styles.barTools}>{tools}</div> : null}
        {/* The account, and the way to the other applications. The builder had
            NO account control at all: an author could not see which account they
            were in, could not reach the shelf or the cabinet, and could not sign
            out. Shared with the platform's header so the two lists cannot
            disagree; the bar above feeds it the header recipe's tokens. */}
        <PlatformAccountMenu compact />
      </header>

      <div className={aside ? styles.bodyWithAside : styles.body}>
        {aside ? (
          <aside className={styles.aside} data-open={asideOpen || undefined} aria-label="Структура курсу">
            {aside}
          </aside>
        ) : null}
        <main className={styles.page}>
          <PlatformTrail steps={trail} />
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * A round, unmistakably-pressable step control.
 *
 * An arrow ALONE reads as decoration, so the control carries its own material
 * and its own hit area — it has to look pressable before it is pressed. A
 * disabled end of the sequence is rendered rather than hidden: a control that
 * vanishes on the last lesson moves everything beside it, and the author loses
 * the target they were aiming at.
 *
 * A button, not a link, because the editor may have to ASK before it navigates
 * — an unsaved paragraph is not something a route change gets to discard
 * quietly. The destination lives in the caller, which is the only place that
 * knows whether it is safe to leave.
 */
export function BuilderStep({
  direction,
  onNavigate,
  label,
}: {
  direction: "prev" | "next";
  /** Absent at either end of the sequence — the control renders disabled. */
  onNavigate?: () => void;
  label: string;
}) {
  return (
    <button
      className={styles.stepAction}
      type="button"
      onClick={onNavigate}
      disabled={!onNavigate}
      aria-label={label}
      title={label}
    >
      <Icon name={direction === "prev" ? "arrow-left" : "arrow-right"} size={20} />
    </button>
  );
}

/**
 * Sign-in, on the builder's own origin.
 *
 * Not a nicety: the builder is a separate origin and therefore a separate
 * Supabase session, so an author who is signed in on the platform arrives here
 * signed out. Without this control the "потрібен вхід" panel would be a dead end
 * — the state every first visit lands in, with nothing to press.
 *
 * `redirectTo` is the current URL, so the deep link an author followed survives
 * the round trip instead of dumping them on the course list.
 */
export function BuilderSignIn() {
  const signIn = async () => {
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window === "undefined" ? undefined : window.location.href },
    });
  };

  return (
    <button className={styles.commitAction} type="button" onClick={signIn}>
      Увійти через Google
    </button>
  );
}

/** A panel that states one thing and stops — loading, empty, refused, broken. */
export function BuilderNotice({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {text ? <p className={styles.panelText}>{text}</p> : null}
      {children}
    </section>
  );
}

/* One account of every way the builder can fail to show you something, so a
   deep link and the course list explain themselves the same way. The earlier
   version had this table only on the list, and an author who opened a lesson
   link while signed out got "не вдалося відкрити урок" with nothing to press —
   the state EVERY first visit to a deep link lands in.

   `not_found` is the one entry that cannot be shared, because the two screens
   mean different things by it. On a course it is content: that course is not
   there. On the SHELF there is no course to be missing — a 404 from the list
   endpoint means the endpoint itself did not answer, which is a build or a
   deployment saying so. The shelf showed "такого курсу немає в базі" for a
   stale dev cache that had 404'd every /api route, and the sentence sent the
   reader looking for a course that was never the problem. */
const FAILURE_COPY: Record<BuilderFailure, { title: string; text: string }> = {
  unauthenticated: {
    title: "Потрібен вхід",
    text: "Білдер працює на власному домені, тому вхід тут окремий від платформи — навіть якщо ви вже увійшли там.",
  },
  forbidden: {
    title: "Немає доступу",
    text: "Цей акаунт не має прав на цей курс. Якщо це помилка — напишіть адміністратору.",
  },
  not_found: {
    title: "Не знайдено",
    text: "Такого курсу немає в базі або він належить іншому автору.",
  },
  invalid: {
    title: "Не пройшло перевірку",
    text: "Структура курсу не пройшла валідацію.",
  },
  network: {
    title: "Немає зв'язку",
    text: "Не вдалося звернутися до сервера. Спробуйте ще раз.",
  },
};

const SHELF_NOT_FOUND = {
  title: "Немає відповіді",
  text: "Сервер не віддав список курсів. Це не про курс — це про застосунок: найчастіше застарілий кеш збірки (зупиніть dev-сервер, видаліть .next і запустіть знову) або незастосована міграція.",
};

/**
 * Renders a failure, with the way out of it when there is one.
 *
 * `scope` says WHICH screen is failing, and it changes exactly one sentence —
 * see the note on `not_found` above.
 */
export function BuilderFailureNotice({
  failure,
  detail,
  scope = "course",
}: {
  failure: BuilderFailure;
  detail?: string;
  scope?: "course" | "shelf";
}) {
  const copy = failure === "not_found" && scope === "shelf" ? SHELF_NOT_FOUND : FAILURE_COPY[failure];
  return (
    <BuilderNotice title={copy.title} text={detail ?? copy.text}>
      {failure === "unauthenticated" ? <BuilderSignIn /> : null}
    </BuilderNotice>
  );
}
