"use client";

/**
 * Course contents, reachable from inside a lesson.
 *
 * Answers "how much is there, and where am I?" without leaving the step the
 * learner is on — the sequential player alone hides the shape of the course.
 * A bottom sheet on phones, a centred dialog on wider screens.
 */

import { useCallback, useEffect, useRef } from "react";
import { MotionLink } from "@/components/platform/MotionLink";

import type { CourseOutlineEntryDto } from "./lmsClient";
import { Icon } from "@/components/Icon";
import styles from "./Lms.module.css";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";

const MODAL_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* HOW FAR THE SHEET HAS TO BE PULLED BEFORE IT LETS GO.
   Far enough that resting a thumb on the grip while reading a title does not
   dismiss the contents, and short enough that a deliberate pull never feels
   like it is being resisted. A quick flick counts for more than a slow drag of
   the same length — that is what `FLICK` is: pixels per millisecond, past which
   the gesture is read as a throw rather than a move. */
const DISMISS_PX = 96;
const DISMISS_MIN_PX = 24;
const FLICK = 0.5;

/**
 * Pull the sheet down to close it.
 *
 * The grip at the top of this panel has been drawing a promise since the sheet
 * existed — every bottom sheet on a phone wears one, and on every one of them
 * it means «you can drag this». Here it meant nothing: the only way out was the
 * × or the backdrop. An affordance that does not do what it depicts is worse
 * than no affordance, because the reader has to discover it is a lie.
 *
 * MOVEMENT IS WRITTEN STRAIGHT TO THE ELEMENT, not through state. A finger
 * emits pointer moves at the screen's refresh rate, and re-rendering a
 * twenty-one step contents list sixty times a second to move it two pixels is
 * how a native-feeling gesture ends up feeling like a web page.
 *
 * THE LIST STILL SCROLLS. The drag only takes the gesture when the panel is
 * already scrolled to its top and the finger is going DOWN — the same rule
 * every sheet on a phone follows, and the reason `touchmove` is bound here by
 * hand with `passive: false` rather than through React: refusing the scroll is
 * the whole mechanism, and a passive listener is not allowed to refuse.
 */
function useSwipeToDismiss(panelRef: React.RefObject<HTMLDivElement | null>, onClose: () => void): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let startY = 0;
    let startedAt = 0;
    let pulled = 0;
    let active = false;

    const settle = (animate: boolean) => {
      panel.style.transition = animate ? "transform 240ms cubic-bezier(0.16, 0.5, 0.2, 1)" : "";
      panel.style.transform = "";
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch || panel.scrollTop > 0) return;
      active = true;
      pulled = 0;
      startY = touch.clientY;
      startedAt = performance.now();
      panel.style.transition = "none";
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!active || !touch) return;
      const dy = touch.clientY - startY;
      if (dy <= 0) {
        /* Upward again — the reader is scrolling the list after all, so the
           gesture goes back to the browser rather than being held hostage. */
        pulled = 0;
        panel.style.transform = "";
        return;
      }
      if (event.cancelable) event.preventDefault();
      pulled = dy;
      panel.style.transform = `translateY(${dy.toFixed(1)}px)`;
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      const flick = pulled / Math.max(1, performance.now() - startedAt);
      if (pulled > DISMISS_PX || (pulled > DISMISS_MIN_PX && flick > FLICK)) {
        onClose();
        return;
      }
      settle(true);
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
      settle(false);
    };
  }, [panelRef, onClose]);
}

export function CourseContentsDrawer({
  courseSlug,
  outline,
  currentSlug,
  draftPreview = false,
  previewReturnTo,
  onClose,
}: {
  courseSlug: string;
  outline: CourseOutlineEntryDto[];
  currentSlug: string;
  draftPreview?: boolean;
  previewReturnTo?: string;
  onClose: () => void;
}) {
  const surfaceHref = useSurfaceHref();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const previewQuery = draftPreview
    ? `?${new URLSearchParams({
        preview: "draft",
        ...(previewReturnTo ? { returnTo: previewReturnTo } : {}),
      }).toString()}`
    : "";

  useSwipeToDismiss(panelRef, onClose);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => restoreFocusRef.current?.focus();
  }, []);

  /**
   * The contents open ON the lesson the reader is in.
   *
   * A twenty-one step course is several screens inside this panel, and a map
   * that opens at step one makes the reader search for themselves before it
   * can answer anything. The current row is already marked — this only brings
   * it under the eye. `center` rather than `start` so the steps on either side
   * come with it: what is next is half the question.
   */
  useEffect(() => {
    const current = panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) return;
    // `auto`, never smooth: this is the panel's opening state, not a movement
    // the reader asked to watch.
    current.scrollIntoView({ block: "center", behavior: "auto" });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind a sheet must not scroll under the finger.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const onBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    },
    [onClose],
  );

  // Steps only, so the drawer's counter agrees with the course map's. Reference
  // pages are a handbook — reading a recipe is not progress through a protocol.
  const steps = outline.filter((entry) => !entry.isReference);
  const completed = steps.filter((entry) => entry.completed).length;

  // Group by module so the course reads as sections, not one long list.
  const groups: Array<{ id: string; title: string; entries: CourseOutlineEntryDto[] }> = [];
  for (const entry of outline) {
    const last = groups[groups.length - 1];
    if (last && last.id === entry.moduleId) last.entries.push(entry);
    else groups.push({ id: entry.moduleId, title: entry.moduleTitle, entries: [entry] });
  }

  return (
    <div className={styles.drawerBackdrop} onClick={onBackdropClick} role="presentation">
      <div className={styles.drawer} ref={panelRef} role="dialog" aria-modal="true" aria-label="Зміст курсу">
        <div className={styles.drawerHandle} aria-hidden="true" />

        <div className={styles.drawerHead}>
          <h2 className={styles.drawerTitle}>Зміст курсу</h2>
          <button
            ref={closeRef}
            className={styles.iconButtonBare}
            type="button"
            onClick={onClose}
            aria-label="Закрити зміст"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className={styles.pagerLabel}>
          Пройдено {completed} з {steps.length}
        </p>

        {groups.map((group) => (
          <div key={group.id}>
            <p className={styles.drawerModule}>{group.title}</p>
            {group.entries.map((entry) => {
              const isCurrent = entry.slug === currentSlug;
              const ahead =
                entry.availability.available && entry.availability.ahead?.reason === "before_day"
                  ? entry.availability.ahead
                  : null;
              const meta = [
                entry.dayIndex ? `День ${entry.dayIndex}` : null,
                entry.durationMin ? `${entry.durationMin} хв` : null,
                ahead ? "за планом попереду" : null,
              ]
                .filter(Boolean)
                .join(" · ");

              if (!entry.availability.available) {
                return (
                  <div key={entry.lessonId} className={styles.drawerItemLocked} aria-disabled="true">
                    <span className={styles.drawerMark} aria-hidden="true">
                      <Icon name="lock" size={14} />
                    </span>
                    <span>
                      {entry.title}
                      <span className={styles.drawerMeta}>
                        {entry.availability.reason === "locked_by_day"
                          ? `відкриється через ${entry.availability.daysRemaining} дн.`
                          : "спершу заверши попередній урок"}
                      </span>
                    </span>
                  </div>
                );
              }

              return (
                <MotionLink
                  key={entry.lessonId}
                  className={isCurrent ? styles.drawerItemCurrent : styles.drawerItem}
                  href={surfaceHref(`/learn/${courseSlug}/${entry.slug}${previewQuery}`)}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={onClose}
                >
                  <span className={entry.completed ? styles.drawerMarkDone : styles.drawerMark} aria-hidden="true">
                    {entry.completed ? <Icon name="check" size={14} /> : (entry.dayIndex ?? "•")}
                  </span>
                  <span>
                    {entry.title}
                    {meta ? <span className={styles.drawerMeta}>{meta}</span> : null}
                  </span>
                </MotionLink>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
