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
 * SIGN-IN HAPPENS HERE, NOT IN THE CABINET (second pass, same day). The first
 * version linked to the cabinet's wall on `my` — another host, a heading about
 * purchases, an email hint about payment, and no way back to the result. Now
 * the card itself is the door: Google returns to this very address, and the
 * emailed code is typed into this card, so the reader never leaves the page
 * their result lives on. Either way the session appears, the page sees it,
 * claims the attempt and opens the reading in place.
 *
 * The result does not depend on this click: the page keeps it for a day from
 * the moment the test finished (lib/tests/keptResult), so a reader who
 * hesitates, goes back or closes the tab loses nothing.
 */

import { useState } from "react";

import { EmailSignIn } from "@/components/auth/EmailSignIn";
import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import { googleQueryParams, readLastAccount } from "@/lib/auth/lastAccount";
import { supabaseClient } from "@/lib/supabaseClient";
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
  /** Fired as the reader chooses a way in — for the attempt's event log. */
  onSignInStart: (method: "google" | "email") => void;
}) {
  const [withEmail, setWithEmail] = useState(false);

  const signInWithGoogle = async () => {
    onSignInStart("google");
    const last = readLastAccount();
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
        queryParams: googleQueryParams(last?.email ? { loginHint: last.email } : undefined),
      },
    });
  };

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
      {withEmail ? (
        <EmailSignIn hint="Надішлемо код із шести цифр — пароль не потрібен." onBack={() => setWithEmail(false)} />
      ) : (
        <div className={gate.ways}>
          <button type="button" className={styles.primaryButton} onClick={() => void signInWithGoogle()}>
            Продовжити з Google
          </button>
          {/* The second way in is a line, not a second button: one tap is the
              common path, and a full-height button under it pushed the door
              past a phone's first screen. */}
          <p className={gate.how}>
            Або{" "}
            <button
              type="button"
              className={gate.inlineWay}
              onClick={() => {
                onSignInStart("email");
                setWithEmail(true);
              }}
            >
              кодом на пошту
            </button>
            , без пароля.
          </p>
        </div>
      )}
    </div>
  );
}
