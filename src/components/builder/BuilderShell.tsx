"use client";

import type { MouseEvent, ReactNode } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import { PlatformAccountMenu } from "@/components/platform/layout/PlatformAccountMenu";
import { PlatformHeader } from "@/components/platform/layout/PlatformHeader";
import { PlatformBackOrgan, PlatformMarkOrgan, PlatformOrgans, chromeOrgans } from "@/components/platform/layout/PlatformOrgans";
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
  organs,
  aside,
  asideOpen,
  asideCompact,
  asideCollapsed,
  onAsideToggle,
  onAsideClose,
  toolLayer,
  pageMode = "workspace",
  onNavigate,
  children,
}: {
  trail?: TrailStep[];
  tools?: ReactNode;
  /**
   * The icon controls of this document, for the phone's trailing capsule.
   *
   * SEPARATE FROM `tools` because a capsule is 48px tall and made of islands:
   * «Збережено · 0 блокери» is a sentence and belongs in the document, an eye
   * and an outline glyph are objects and belong in the chrome. Rendered in two
   * places and visible in one — `PlatformOrgans` is mobile-only and
   * `PlatformHeader` is desktop-only, so each viewport draws exactly one of
   * them, and neither has to ask a media query in JavaScript what to mount.
   */
  organs?: ReactNode;
  /** The course outline. A rail on desktop, a drawer below 901px. */
  aside?: ReactNode;
  asideOpen?: boolean;
  /** Narrows a persistent desktop rail to its icon column. */
  asideCompact?: boolean;
  /** Hides the desktop outline while leaving a stable reopen control. */
  asideCollapsed?: boolean;
  onAsideToggle?: () => void;
  /** Closes the phone's contents sheet — its scrim and its own close control. */
  onAsideClose?: () => void;
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

  /* «Ліворуч — вихід звідси». The trail already knows the parent, so the phone's
     leading island is derived rather than configured: the workshop's root shows
     the mark, a course shows the way back to the courses, a lesson shows the way
     back to its course. A control that leaves the APPLICATION from inside an
     unsaved lesson was the wrong answer to the only question that corner
     answers.

     THE NEAREST STEP THAT LEADS SOMEWHERE, not the one directly above. A
     lesson's trail is «Курси / Курс / Модуль / Урок» and the MODULE is not a
     place — it has no route, because there is no page for one. Reading
     `length - 2` blindly found that dead step, fell through to the mark, and
     the arrow never appeared on the one screen it matters most. */
  const parent = trail
    .slice(0, -1)
    .reverse()
    .find((step) => step.onNavigate || step.href) ?? null;

  /* Two ways to fold one panel, one thing the control has to say. `collapsed`
     empties the rail, `compact` narrows it to its icon column — but from the
     button's side both are "folded", and it must point the same way, name the
     same action and report the same `aria-expanded` in either. */
  const asideFolded = Boolean(asideCollapsed || asideCompact);

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
    <div className={styles.shell} data-cw-organs="mobile" onClickCapture={interceptNavigation}>
      {/* Explicitly personal: localhost and previews host the storefront and
          authoring app together, so hostname inference alone picks the public
          navigation there. The route, not the transport, owns this identity. */}
      {/* THE PHONE'S CHROME HERE TOO (2026-09-06). The workshop was the last
          surface still opening a bar on a phone, and the bar had nothing left
          to put in it: `.workspaceTopbarContext` is `display: none` below
          901px and the trail and the tools already render in flow as
          `.pageTrail`. What was left was a mark, an avatar, and a full-width
          band of nothing between them — the same degenerate bar the storefront
          had, holding open ~52px of an editor's vertical space.

          `reveal="always"`, and that is the whole reason `reveal` is a choice.
          Scrolling up in an editor is working with the text, not leaving it, so
          chrome that steps aside on the way down would be hiding from the
          gesture its user makes most. See PlatformOrgans. */}
      <PlatformOrgans
        scope="mobile"
        reveal="always"
        label="Майстерня"
        left={parent?.onNavigate
          ? <PlatformBackOrgan onNavigate={parent.onNavigate} label={`Назад: ${parent.label}`} />
          : parent?.href
            ? <PlatformBackOrgan href={parent.href} label={`Назад: ${parent.label}`} />
            : <PlatformMarkOrgan />}
        /* No `routes`. The workshop is a focused mode: `PlatformHeader` gives
           it an empty `navSource` for the same reason, so a route map in the
           sheet would be a map the bar above 901px does not draw. */
        right={(
          /* THE DOCUMENT'S TOOLS, THEN THE ACCOUNT. The capsule is the reader's
             own recipe (`chromeOrgans.cluster`): several controls travelling as
             one object, so they read as this lesson's toolkit rather than as
             loose discs over the text. The account stays its own island beside
             it — it belongs to the person, not to the document. */
          <span className={chromeOrgans.pair}>
            {organs ? <span className={chromeOrgans.cluster}>{organs}</span> : null}
            <PlatformAccountMenu compact />
          </span>
        )}
      />
      <PlatformHeader
        surface="personal"
        mode="workspace"
        scope="desktop"
        workspaceContent={(
          <div className={styles.workspaceTopbarContext}>
            {showTrail ? <PlatformTrail steps={trail} /> : <span />}
            {tools || organs ? <div className={styles.workspaceTopbarTools}>{organs}{tools}</div> : <span />}
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
            {/* THE PHONE'S CONTENTS IS A SHEET, NOT A STACK (2026-09-06).
                `.aside[data-open]` used to be `display: block` in normal flow,
                so pressing «Зміст» inside a lesson pushed the whole outline —
                seven lessons, «Додати урок», «Додати модуль» — ABOVE the
                paragraph being edited, and the document the author was working
                in left the screen. A panel that displaces its own subject is
                not a panel.

                It is the library's drawer now: the reader's contents sheet
                (`.drawerBackdrop` / `.drawer` in Lms.module.css) rises from the
                bottom over a shield, and the lesson stays where it was. ONE
                DOM in both directions — the desktop rail and the phone sheet
                are the same element with a media query between them, because
                choosing what to MOUNT from a media query in JavaScript is
                answered differently on the server and in the browser. */}
            {onAsideClose ? (
              <button
                className={styles.asideScrim}
                type="button"
                tabIndex={-1}
                aria-label="Закрити зміст"
                onClick={onAsideClose}
              />
            ) : null}
            {/* THE SHEET IS ITS OWN ELEMENT, and that is what lets it be the
                platform's sheet rather than a copy of it. `.aside` is a rail
                above 901px and a drawer below it, and `composes` cannot be
                scoped to a media query — so the material goes on a wrapper that
                is `display: contents` on the desktop, where it has no business
                existing at all. */}
            <div className={styles.asideSheet}>
              <span className={styles.asideHandle} aria-hidden="true" />
              <div className={styles.asideContent}>{aside}</div>
            </div>
            {onAsideToggle ? (
              <button
                className={styles.asideCollapseAction}
                type="button"
                onClick={onAsideToggle}
                aria-label={asideFolded ? "Розгорнути структуру курсу" : "Згорнути структуру курсу"}
                aria-expanded={!asideFolded}
              >
                <Icon name={asideFolded ? "arrow-right" : "arrow-left"} size={18} />
                <HandGraphic className={styles.stepInkRing} name="ink-ring" size={42} />
              </button>
            ) : null}
          </aside>
        ) : null}
        <main className={styles.page} data-mode={pageMode}>
          {/* NO PATH IN THE DOCUMENT ANY MORE (2026-09-06). This row exists
              only below 901px (`.pageTrail` is hidden above it), and there the
              breadcrumb said in words the move the leading island now makes
              with an arrow — «← Short-Перезавантаження» printed one line above
              a title naming the same document, and it was the widest object in
              a row that also has to carry the save state. What is left is what
              the row is for: what this document is doing right now. */}
          {tools ? (
            <div className={styles.pageTrail}>
              <div className={styles.pageTools}>{tools}</div>
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
