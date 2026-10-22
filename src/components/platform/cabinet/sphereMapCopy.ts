/**
 * Карта сфер — its strings. Kept beside the cabinet's own copy rather than in
 * it: the map is one screen and one card, and folding forty lines into
 * `copy.ts` would make that file about two features.
 *
 * Sphere names are NOT here. They live with the axis ids in
 * `src/lib/profile/sphereMap.ts`, because the id and its working name are one
 * record and a rename is made in one place.
 */

import { SPHERE_AXES, type SphereAxisId } from "@/lib/profile/sphereMap";
import type { ProfileLang } from "../profile/types";

export type SphereMapCopy = {
  label: string;
  title: string;
  lead: string;
  loadingTitle: string;
  loadingLead: string;
  errorTitle: string;
  errorLead: string;
  retry: string;
  saveError: string;
  modeLabel: string;
  modeNow: string;
  modeGoal: string;
  hintNow: string;
  hintGoal: string;
  legendNow: string;
  legendGoal: string;
  legendStart: string;
  radarTitle: string;
  scaleLabel: (sphere: string, mode: "now" | "goal") => string;
  unset: string;
  noteLabel: string;
  notePlaceholder: string;
  focusTitle: string;
  focusEmpty: string;
  focusSuggested: string;
  focusAdd: string;
  focusRemove: string;
  focusFull: string;
  focusChip: string;
  candidateChip: string;
  gap: (gap: number) => string;
  footer: string;
  cardLabel: string;
  cardTitle: string;
  cardEmpty: string;
  cardFocus: string;
  cardOpen: string;
  cardStart: string;
};

export function sphereName(id: SphereAxisId, lang: ProfileLang): string {
  const axis = SPHERE_AXES.find((item) => item.id === id);
  if (!axis) return id;
  return lang === "en" ? axis.nameEn : axis.name;
}

export function sphereShort(id: SphereAxisId, lang: ProfileLang): string {
  const axis = SPHERE_AXES.find((item) => item.id === id);
  if (!axis) return id;
  return lang === "en" ? axis.shortEn : axis.short;
}

export function getSphereMapCopy(lang: ProfileLang): SphereMapCopy {
  if (lang === "en") {
    return {
      label: "Profile",
      title: "Sphere map",
      lead: "Your own rating, from 0 to 10. Not a health score — a bearing for where your attention goes.",
      loadingTitle: "Opening your map…",
      loadingLead: "Seven spheres, as you rated them.",
      errorTitle: "Could not load the map",
      errorLead: "Nothing has been lost. Try loading it again.",
      retry: "Try again",
      saveError: "The map was not saved. Check the connection — your change is still on the screen.",
      modeLabel: "Which rating to set",
      modeNow: "A · now",
      modeGoal: "B · in a year",
      hintNow: "Honestly, how this sphere is now. You can add a live example to the rating.",
      hintGoal: "A direction, not an ideal. A gap of 3 or more becomes a focus candidate.",
      legendNow: "now",
      legendGoal: "in a year",
      legendStart: "at the start",
      radarTitle: "Sphere map",
      scaleLabel: (sphere, mode) => `${sphere}: ${mode === "now" ? "now" : "in a year"}`,
      unset: "—",
      noteLabel: "Live example",
      notePlaceholder: "What it looks like this week",
      focusTitle: "Cycle focus · three at most",
      focusEmpty: "Nothing in focus yet. Open a sphere and add it.",
      focusSuggested: "Candidates by the gap:",
      focusAdd: "Add to focus",
      focusRemove: "Remove from focus",
      focusFull: "Three spheres are already in focus.",
      focusChip: "focus",
      candidateChip: "candidate",
      gap: (gap) => `gap ${gap}`,
      footer: "Sphere names are working names, from the programme. Only you can see the map.",
      cardLabel: "Map",
      cardTitle: "Sphere map",
      cardEmpty: "Rate seven spheres of your life from 0 to 10 — now and in a year.",
      cardFocus: "Focus",
      cardOpen: "Open the map",
      cardStart: "Make a map",
    };
  }

  return {
    label: "Профіль",
    title: "Карта сфер",
    lead: "Ваша оцінка, від 0 до 10. Не бал здоров'я, а орієнтир, куди йде увага.",
    loadingTitle: "Відкриваємо вашу карту…",
    loadingLead: "Сім сфер, як ви їх оцінили.",
    errorTitle: "Не вдалося завантажити карту",
    errorLead: "Нічого не втрачено. Спробуйте завантажити ще раз.",
    retry: "Спробувати ще раз",
    saveError: "Карту не збережено. Перевірте зв'язок — ваша зміна лишилася на екрані.",
    modeLabel: "Яку оцінку ставити",
    modeNow: "А · зараз",
    modeGoal: "Б · через рік",
    hintNow: "Чесно, якою сфера є зараз. До оцінки можна дописати живий приклад.",
    hintGoal: "Напрямок, а не ідеал. Розрив від 3 стає кандидатом у фокус.",
    legendNow: "зараз",
    legendGoal: "через рік",
    legendStart: "на старті",
    radarTitle: "Карта сфер",
    scaleLabel: (sphere, mode) => `${sphere}: ${mode === "now" ? "зараз" : "через рік"}`,
    unset: "—",
    noteLabel: "Живий приклад",
    notePlaceholder: "Як це виглядає цього тижня",
    focusTitle: "Фокус циклу · не більше трьох",
    focusEmpty: "У фокусі поки нічого. Відкрийте сферу й додайте її.",
    focusSuggested: "Кандидати за розривом:",
    focusAdd: "Додати у фокус",
    focusRemove: "Прибрати з фокусу",
    focusFull: "У фокусі вже три сфери.",
    focusChip: "фокус",
    candidateChip: "кандидат",
    gap: (gap) => `розрив ${gap}`,
    footer: "Назви сфер робочі, з програми. Карту бачите тільки ви.",
    cardLabel: "Карта",
    cardTitle: "Карта сфер",
    cardEmpty: "Оцініть сім сфер свого життя від 0 до 10 — зараз і через рік.",
    cardFocus: "Фокус",
    cardOpen: "Відкрити карту",
    cardStart: "Скласти карту",
  };
}
