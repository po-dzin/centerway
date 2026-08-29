"use client";

import { Icon } from "@/components/Icon";
import { useChromeReveal } from "@/components/platform/layout/useChromeReveal";
import styles from "./Lms.module.css";

/**
 * The way back to the start of a long page.
 *
 * IT APPEARS ON THE SAME GESTURE AS THE TOPBAR, and that is the whole design.
 * A floating button that sits there for the entire read is exactly the chrome
 * this reader just spent an auto-hiding topbar getting rid of; one that appears
 * purely on depth is worse still, since depth is where you are READING. Scroll
 * up and the bar comes back at the top, this comes back at the thumb — one
 * gesture, one answer, and a page that is otherwise nothing but the lesson.
 *
 * WHY IT IS NEEDED AT ALL, given that the bar returns on the same flick: the
 * bar returning does not move the page. A twenty-one lesson course map and a
 * lesson of twenty-two blocks are both several screens of flicking to get back
 * to the title, and "scroll up" is the gesture a reader is already making when
 * they discover that.
 *
 * IT CLEARS THE COMPLETION BAR rather than sharing a corner with it. The lesson
 * pins «Позначити урок пройденим» to the bottom of the reading column, which on
 * a phone is nearly the full width — a control dropped in the same corner would
 * land on top of the one thing this page exists to let you press.
 */
export function ReaderTopButton({
  /** The lesson pins a completion control to the bottom; the course map does not. */
  clearsCompletion = false,
}: {
  clearsCompletion?: boolean;
}) {
  const { hidden, deep } = useChromeReveal(true);
  const shown = deep && !hidden;

  return (
    <button
      className={styles.topButton}
      type="button"
      data-shown={shown ? "true" : undefined}
      data-clears={clearsCompletion ? "completion" : undefined}
      /* Out of the tab order and out of the accessibility tree while it is not
         offered. Nothing is lost: Home already does this from the keyboard, so
         a hidden control here would be a second, worse route to the same place
         — and a focusable button a reader cannot see is the bug this pattern is
         famous for. */
      tabIndex={shown ? undefined : -1}
      aria-hidden={shown ? undefined : true}
      aria-label="На початок сторінки"
      onClick={() => {
        /* `smooth` is a request, not an instruction: a reader who asked their
           system for less motion gets the instant jump, because the browser
           resolves `behavior: smooth` against that preference itself. */
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <Icon name="arrow-up" size={18} />
    </button>
  );
}
