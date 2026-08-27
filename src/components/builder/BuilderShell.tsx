"use client";

import type { MouseEvent, ReactNode } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import { PlatformHeader } from "@/components/platform/layout/PlatformHeader";
import { PlatformTrail, type TrailStep } from "@/components/platform/PlatformTrail";
import { supabaseClient } from "@/lib/supabaseClient";
import type { BuilderFailure } from "./builderClient";
import styles from "./Builder.module.css";

/**
 * The builder's chrome — the restrained internal side of the platform chrome.
 *
 * IT USED TO BE ITS OWN BAR: a flush white strip with a small mark, the word
 * «Білдер» in mono caps, and an avatar at the far right. Beside the shelf's
 * floating rounded plate with a wordmark and a nav, it read as a different
 * product — and it was a second copy of a header recipe, kept in step by hand
 * through a mapping block of `--platform-header-*` values in this module's CSS.
 * Both problems have one component-level fix: render the shared personal
 * header in its workspace mode. Identity and account behaviour stay one
 * system; the material becomes a flat warm panel rather than storefront glass.
 *
 * Route context and document-level actions share the workspace topbar: the
 * brand remains application chrome, while breadcrumb, preview and save state
 * describe the exact course or lesson currently being edited.
 *
 * THE RAIL is course-local navigation. In the lesson editor it carries the
 * outline; on the course workspace it carries only the three stable modes and
 * release health. It never becomes a second editor. Below 901px the course
 * workspace uses an in-flow mode strip, while the long lesson outline remains
 * an explicit drawer. On a wide course workspace the stable mode rail can
 * collapse to its icon column without changing the document measure.
 */

export function BuilderShell({
  trail = [],
  tools,
  aside,
  asideOpen,
  asideCompact,
  asideCollapsed,
  onAsideToggle,
  toolLayer,
  pageMode = "workspace",
  onNavigate,
  children,
}: {
  trail?: TrailStep[];
  tools?: ReactNode;
  /** The course outline. A rail on desktop, a drawer below 901px. */
  aside?: ReactNode;
  asideOpen?: boolean;
  /** Narrows a persistent desktop rail to its icon column. */
  asideCompact?: boolean;
  /** Hides the desktop outline while leaving a stable reopen control. */
  asideCollapsed?: boolean;
  onAsideToggle?: () => void;
  /** Contextual right rail on desktop and bottom sheet on compact layouts. */
  toolLayer?: ReactNode;
  /** A lesson document uses the learner's readable measure. */
  pageMode?: "workspace" | "document";
  /** Flush-aware navigation supplied by an editing surface. */
  onNavigate?: (href: string) => void;
  children: ReactNode;
}) {
  /* ONE BAR AT EVERY LEVEL. The context row used to appear only once a trail
     had two steps and disappear on the course index, so moving between the
     three builder levels changed the height of the chrome itself — the one
     part of the screen that should never move. The row is now unconditional:
     a level with nothing to say renders it empty, and the frame stays put.
     The TRAIL still needs two steps, because a breadcrumb showing only its own
     root is not a path — it is the application's name written twice. */
  const showTrail = trail.length > 1;

  const interceptNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if (!onNavigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    // In-page mode tabs own their hash and do not leave the document.
    if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;
    event.preventDefault();
    event.stopPropagation();
    onNavigate(`${destination.pathname}${destination.search}${destination.hash}`);
  };

  return (
    <div className={styles.shell} onClickCapture={interceptNavigation}>
      {/* Explicitly personal: localhost and previews host the storefront and
          authoring app together, so hostname inference alone picks the public
          navigation there. The route, not the transport, owns this identity. */}
      <PlatformHeader
        surface="personal"
        mode="workspace"
        workspaceContent={(
          <div className={styles.workspaceTopbarContext}>
            {showTrail ? <PlatformTrail steps={trail} /> : <span />}
            {tools ? <div className={styles.workspaceTopbarTools}>{tools}</div> : <span />}
          </div>
        )}
      />

      <div
        className={aside ? styles.bodyWithAside : styles.body}
        data-aside-collapsed={asideCollapsed || undefined}
        data-aside-compact={asideCompact || undefined}
      >
        {aside ? (
          <aside
            className={styles.aside}
            data-open={asideOpen || undefined}
            data-compact={asideCompact || undefined}
            data-collapsed={asideCollapsed || undefined}
            aria-label="Навігація курсу"
          >
            <div className={styles.asideContent}>{aside}</div>
            {onAsideToggle ? (
              <button
                className={styles.asideCollapseAction}
                type="button"
                onClick={onAsideToggle}
                aria-label={asideCollapsed ? "Розгорнути структуру курсу" : "Згорнути структуру курсу"}
                aria-expanded={!asideCollapsed}
              >
                <Icon name={asideCollapsed ? "arrow-right" : "arrow-left"} size={18} />
                <HandGraphic className={styles.stepInkRing} name="ink-ring" size={42} />
              </button>
            ) : null}
          </aside>
        ) : null}
        <main className={styles.page} data-mode={pageMode}>
          {/* Trail and tools on one line: where am I, and the handful of
              controls that act on this exact course or lesson. */}
          {showTrail || tools ? (
            <div className={styles.pageTrail}>
              {showTrail ? <PlatformTrail steps={trail} /> : null}
              {tools ? <div className={styles.pageTools}>{tools}</div> : null}
            </div>
          ) : null}
          {children}
        </main>
        {toolLayer}
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
      <HandGraphic className={styles.stepInkRing} name="ink-ring" size={42} />
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
    text: "Майстерня працює на власному домені, тому вхід тут окремий від платформи — навіть якщо ви вже увійшли там.",
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
  conflict: {
    title: "Курс змінився в іншій вкладці",
    text: "Перезавантажте сторінку, щоб отримати актуальну версію і не перезаписати чужі зміни.",
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

function failureText(failure: BuilderFailure, detail: string | undefined, fallback: string): string {
  if (!detail) return fallback;

  if (failure === "invalid" && detail.startsWith("lms_lesson_duplicate_day_index")) {
    return "Два уроки мають однаковий номер дня. Змініть день одного з уроків і спробуйте знову.";
  }

  // API and database identifiers belong in logs. A person-facing recovery
  // state should never turn a 500 response into an unexplained code dump.
  if (failure === "network" || detail.startsWith("lms_")) return fallback;

  return detail;
}

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
    <BuilderNotice title={copy.title} text={failureText(failure, detail, copy.text)}>
      {failure === "unauthenticated" ? <BuilderSignIn /> : null}
      {failure === "network" ? (
        <div className={styles.panelActions}>
          <button className={styles.quietAction} type="button" onClick={() => window.location.reload()}>
            Спробувати ще раз
          </button>
        </div>
      ) : null}
    </BuilderNotice>
  );
}
