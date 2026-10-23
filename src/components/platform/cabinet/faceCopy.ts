/**
 * The profile face's words (2026-10-23), from the approved «Профіль CenterWay»
 * canvas (Main board). Kept beside the control rather than in `copy.ts`: they
 * belong to one block and change with it.
 */

import type { ProfileLang } from "../profile/types";

export type FaceCopy = {
  /** The avatar button's own name — it opens the sheet below. */
  open: string;
  sheetLabel: string;
  close: string;
  view: string;
  upload: string;
  /** The way into the fuller editor: crop, name, cover. Authors only for now. */
  settings: string;
  viewerLabel: (name: string) => string;
  viewerUpload: string;
  uploading: string;
  /** After a successful upload. The author form names the author page; the learner form has none. */
  doneAuthor: string;
  doneLearner: string;
};

const COPY: Record<ProfileLang, FaceCopy> = {
  uk: {
    open: "Змінити фото",
    sheetLabel: "Фото профілю",
    close: "Закрити",
    view: "Переглянути",
    upload: "Завантажити фото",
    settings: "Кадрувати, ім'я, обкладинка",
    viewerLabel: (name) => `${name} · фото профілю`,
    viewerUpload: "Завантажити",
    uploading: "Завантажуємо фото…",
    doneAuthor: "Нове фото вже всюди: топбар, коментарі, сторінка автора, Стрічка, тести й програми.",
    doneLearner: "Нове фото вже всюди: топбар, коментарі, Стрічка, тести й програми.",
  },
  en: {
    open: "Change photo",
    sheetLabel: "Profile photo",
    close: "Close",
    view: "View",
    upload: "Upload photo",
    settings: "Crop, name, cover",
    viewerLabel: (name) => `${name} · profile photo`,
    viewerUpload: "Upload",
    uploading: "Uploading the photo…",
    doneAuthor:
      "Your new photo is everywhere now: the top bar, comments, your author page, the Feed, tests and programs.",
    doneLearner: "Your new photo is everywhere now: the top bar, comments, the Feed, tests and programs.",
  },
};

export function getFaceCopy(lang: ProfileLang): FaceCopy {
  return COPY[lang];
}
