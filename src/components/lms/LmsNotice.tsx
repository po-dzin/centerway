"use client";

/**
 * Failure states for the learner surfaces.
 *
 * Every message names the next action. "Немає доступу" without a way forward is
 * a dead end in a funnel whose whole point is the next step.
 */

import Link from "next/link";

import type { LmsFailure } from "./lmsClient";
import styles from "./Lms.module.css";

const COPY: Record<LmsFailure, { title: string; text: string; href?: string; cta?: string }> = {
  unauthenticated: {
    title: "Потрібен вхід",
    text: "Увійди в свій профіль, щоб відкрити курс — прогрес зберігається за твоїм акаунтом.",
    href: "/profile",
    cta: "Перейти до профілю",
  },
  unauthorized: {
    title: "Сесія завершилась",
    text: "Схоже, сесія застаріла. Онови сторінку або увійди ще раз.",
    href: "/profile",
    cta: "Перейти до профілю",
  },
  course_not_found: {
    title: "Курс не знайдено",
    text: "Такого курсу немає. Можливо, змінилось посилання.",
    href: "/programs",
    cta: "Усі програми",
  },
  not_published: {
    title: "Курс ще готується",
    text: "Матеріали цього курсу ще не опубліковані. Ми повідомимо, щойно він відкриється.",
    href: "/programs",
    cta: "Усі програми",
  },
  not_entitled: {
    title: "Доступ ще не відкрито",
    text: "Цей курс відкривається після оплати. Якщо ти вже оплатив(-ла) — перевір профіль: там видно всі покупки й доступи.",
    href: "/profile",
    cta: "Мої покупки",
  },
  expired: {
    title: "Термін доступу минув",
    text: "Доступ до цього курсу завершився. Напиши нам — розберемось.",
    href: "/profile",
    cta: "Мій профіль",
  },
  lesson_not_found: {
    title: "Урок не знайдено",
    text: "Такого уроку немає в цьому курсі.",
  },
  lesson_locked: {
    title: "Урок ще закритий",
    text: "Цей крок відкриється за розкладом курсу — повернись, коли він стане доступним.",
  },
  network: {
    title: "Не вдалося завантажити",
    text: "Перевір зʼєднання і спробуй ще раз.",
  },
};

export function LmsNotice({ failure, onRetry }: { failure: LmsFailure; onRetry?: () => void }) {
  const copy = COPY[failure];

  return (
    <section className={styles.notice}>
      <h1 className={styles.noticeTitle}>{copy.title}</h1>
      <p className={styles.noticeText}>{copy.text}</p>
      {copy.href && copy.cta ? (
        <Link className={styles.ctaLink} href={copy.href}>
          {copy.cta}
        </Link>
      ) : null}
      {onRetry && (failure === "network" || failure === "unauthorized") ? (
        <button className={styles.ctaLink} type="button" onClick={onRetry}>
          Спробувати ще раз
        </button>
      ) : null}
    </section>
  );
}
