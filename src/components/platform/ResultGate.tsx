"use client";

/**
 * The door between a test's verdict and its full reading (2026-10-02).
 *
 * THE TEST IS FREE, THE KEEPING IS THE ACCOUNT. Nothing is asked before the
 * first question (2026-09-05) and the verdict — the type, its name, the first
 * thing to know about it — is shown to everybody. What sits behind the door is
 * what only makes sense once the result has an owner: the full reading, the
 * proportions, the practices, and the result kept in the cabinet to compare
 * with the next run. The optional «save» that stood here instead was pressed
 * by nobody for three weeks, and no anonymous result reached an account.
 *
 * THE PLATFORM'S DOOR, NOT A GOOGLE BUTTON. The link goes to the cabinet's
 * sign-in wall with `?next=` set to this page (`useSignInHref`), so the reader
 * can use Google or an emailed code, and comes back here when the session
 * exists. The caller's `onBeforeLeave` runs on the click, before the page
 * goes: it shelves the result in sessionStorage so the page can put it back
 * and hand the attempt to the account on return.
 */

import { Icon } from "@/components/Icon";
import { useSignInHref } from "@/components/auth/useSignInReturn";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import gate from "./ResultGate.module.css";

export function ResultGate({
  title,
  includes,
  onBeforeLeave,
}: {
  title: string;
  /** What opens after sign-in, in the reader's words, three or four lines. */
  includes: readonly string[];
  onBeforeLeave: () => void;
}) {
  const surfaceHref = useSurfaceHref();
  const href = useSignInHref(surfaceHref("/profile"));

  return (
    <div className={styles.card} data-tone="support" data-cw-result-gate="">
      <p className={styles.label}>Повний результат</p>
      <h2>{title}</h2>
      <ul className={gate.includes}>
        {includes.map((line) => (
          <li key={line}>
            <Icon name="check" size={20} className={gate.mark} />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className={styles.diagnosticActions}>
        <a className={styles.primaryButton} href={href} onClick={onBeforeLeave}>
          Увійти і відкрити
        </a>
      </div>
      <p className={gate.how}>Через Google або кодом на пошту. Після входу ви повернетеся сюди.</p>
    </div>
  );
}
