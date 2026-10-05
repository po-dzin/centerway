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
 * ONE BUTTON TO THE ONE DOOR (2026-10-03). Two passes put the sign-in INSIDE
 * this card — Google as a button, the emailed code as a line that swapped the
 * card into an address form. That made this card a second sign-in screen with
 * its own choices, beside the one every other entry uses. G: «зачем-то сразу
 * раздвоение вариантов вместо одной кнопки, которая перевела бы на единую
 * страницу входа». So the card asks for nothing but the click: «Увійти» leads
 * to the platform's door (the cabinet's wall, same as the header's «Увійти»),
 * carrying this address as `?next=`. The door offers Google and the code, and
 * `useSignInReturn` brings the reader back here once the session exists — the
 * session cookie is shared across `www` and `my`, so this page sees it,
 * claims the attempt and opens the reading in place.
 *
 * The result does not depend on this click: the page keeps it for a day from
 * the moment the test finished (lib/tests/keptResult), so a reader who
 * hesitates, goes back or closes the tab loses nothing.
 */

import Link from "next/link";

import { useSignInHref } from "@/components/auth/useSignInReturn";
import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import gate from "./ResultGate.module.css";

export function ResultGate({
  title,
  includes,
  onSignInStart,
}: {
  title: string;
  /** What opens after sign-in: four short lines, one row each on a phone, so
      the verdict and the door fit one screen. */
  includes: readonly string[];
  /** Fired as the reader heads to the door — for the attempt's event log. */
  onSignInStart: () => void;
}) {
  const surfaceHref = useSurfaceHref();
  const signInHref = useSignInHref(surfaceHref("/profile"));

  return (
    <div className={styles.card} data-tone="proof" data-cw-result-gate="">
      <h2>{title}</h2>
      <ul className={gate.includes}>
        {includes.map((line) => (
          <li key={line}>
            <Icon name="lock" size={18} className={gate.mark} />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className={gate.ways}>
        <Link className={styles.primaryButton} href={signInHref} onClick={onSignInStart}>
          Увійти
        </Link>
      </div>
    </div>
  );
}
