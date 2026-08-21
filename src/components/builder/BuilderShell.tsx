"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { supabaseClient } from "@/lib/supabaseClient";
import type { BuilderFailure } from "./builderClient";
import styles from "./Builder.module.css";

/**
 * The builder's chrome — deliberately almost nothing.
 *
 * One bar: which application this is, where in a course you are, and one way
 * back. No navigation, because the builder has exactly one hierarchy (courses →
 * course → lesson) and the crumb IS that hierarchy; a nav would be a second,
 * competing account of the same three levels.
 *
 * The word "БІЛДЕР" beside the mark is load-bearing. Author and learner share a
 * design system and a browser, and an author who lands here from a link must
 * never have to work out which of the two applications they are looking at.
 */
export function BuilderShell({
  crumb,
  back,
  action,
  children,
}: {
  crumb?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        {back ? (
          <Link className={styles.barAction} href={back.href}>
            {back.label}
          </Link>
        ) : (
          <span className={styles.barBrand}>
            CenterWay <span className={styles.barKind}>Білдер</span>
          </span>
        )}
        <span className={styles.barSpacer} />
        {crumb ? <span className={styles.barCrumb}>{crumb}</span> : null}
        {action}
      </header>
      <main className={styles.page}>{children}</main>
    </div>
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
    <button className={styles.barAction} type="button" onClick={signIn}>
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
   the state EVERY first visit to a deep link lands in. */
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

/** Renders a failure, with the way out of it when there is one. */
export function BuilderFailureNotice({ failure, detail }: { failure: BuilderFailure; detail?: string }) {
  const copy = FAILURE_COPY[failure];
  return (
    <BuilderNotice title={copy.title} text={detail ?? copy.text}>
      {failure === "unauthenticated" ? <BuilderSignIn /> : null}
    </BuilderNotice>
  );
}
