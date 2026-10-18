/**
 * The feed's words, in one place (Ukrainian; the voice is not final, so a
 * change here is a copy change and waits for G's yes like any other).
 */

export const feedCopy = {
  heroBadge: "Спільнота CenterWay",
  title: "Стрічка",
  lead: "Дописи авторів CenterWay: практики, думки, події.",
  empty: "Тут поки порожньо. Автори скоро напишуть перші дописи.",
  /* «Стрічка · початок» (mockup 16.10; G's ok on the words still pending). */
  pinned: "закріплено",
  emptyFiltered: "За цим фільтром дописів немає.",
  more: "Показати ще",
  loading: "Завантажуємо…",
  loadFailed: "Не вдалося завантажити дописи. Спробуйте ще раз.",

  filter: "Фільтри",
  filterTitle: "Фільтр стрічки за темою і автором",
  filterAll: "Усі",
  filterTopics: "Тема",
  filterAuthors: "Автор",
  filterReset: "Скинути",

  reactionsLabel: "Реакції",
  addReaction: "Додати реакцію",
  pickerTitle: "Реакції",
  close: "Закрити",

  comments: ["коментар", "коментарі", "коментарів"] as [string, string, string],
  commentsNone: "Коментувати",
  commentsHide: "Сховати коментарі",
  writeComment: "Написати коментар…",
  writeReply: "Ваша відповідь…",
  send: "Надіслати",
  reply: "Відповісти",
  replyingTo: "Відповідь для",
  cancel: "Скасувати",
  hide: "Приховати",
  remove: "Видалити",
  edit: "Редагувати",
  viewerLabel: "Фото з допису",
  viewerClose: "Закрити",
  viewerPrev: "Попереднє фото",
  viewerNext: "Наступне фото",
  backToFeed: "До стрічки",
  pin: "Закріпити",
  unpin: "Відкріпити",
  pinFailed: "Не вдалося змінити закріплення.",
  edited: "змінено",
  hidden: "Допис приховано.",
  hideFailed: "Не вдалося приховати допис.",
  postMenu: "Дії з дописом",
  deleteAsk: "Видалити допис?",
  deleteYes: "Так",
  deleteNo: "Ні",
  deleted: "Допис видалено.",
  deleteFailed: "Не вдалося видалити допис.",
  byAuthor: "автор",
  commentHeld: "Чекає перевірки команди: поки бачите тільки ви.",
  commentHeldToast: "Коментар чекає перевірки команди.",
  commentFailed: "Не вдалося надіслати коментар.",

  signInTo: "Увійдіть, щоб реагувати, коментувати й позначати.",
  signIn: "Увійти",

  markAdd: "Позначити",
  markNote: "Нотатка",
  markSave: "Зберегти",
  markRemove: "Прибрати позначку",
  markSaved: "Збережено в «Мій журнал».",
  markFailed: "Не вдалося зберегти позначку.",
  notePlaceholder: "Ваша думка про це…",

  openProgram: "Відкрити програму",
  openLesson: "Відкрити в програмі",

  heroAlt:
    "Стіна студії з аркушами на малярному скотчі: сторінка з текстом, список із відмітками, два чорно-білі фото й смужка з намальованою звуковою хвилею",

  with: "з",
  readMore: "Читати далі",
  readLess: "Згорнути",
  photo: "Фото до допису",
  photoOf: (index: number, total: number) => `Фото ${index} з ${total}`,
  photos: "Фото допису",
  spoiler: "Спойлер · натисніть, щоб побачити",
  spoilerLabel: "Показати фото, приховане як спойлер",
  postVideo: "Відео допису",
  audio: "Аудіо",

  reactionsTotal: (total: number, mine: number) =>
    total > 0 ? `Реакції, ${total}${mine > 0 ? `, ваших ${mine} з 3` : ""}. Додати реакцію` : "Додати реакцію",
  reactionLimitHint: (mine: number) => `Можна до 3 реакцій · ваших ${mine}`,
  reactionLimit: "Ваші 3 з 3 — зніміть одну, щоб обрати іншу",
  reactionFailed: "Не вдалося поставити реакцію.",
  /** One line of the chip's hint: «Вогонь 11 · Олена К., Марко Д. і ще 8», with «ви» first when the reader pressed it. */
  reactionWho: (name: string, count: number, who: string[], mine: boolean) => {
    const people = [...(mine ? ["ви"] : []), ...who];
    const rest = count - people.length;
    if (people.length === 0) return `${name} ${count}`;
    return `${name} ${count} · ${people.join(", ")}${rest > 0 ? ` і ще ${rest}` : ""}`;
  },
  /** «Мої дописи»: the kinds beyond the ones named. */
  reactionKindsMore: (n: number) => `і ще ${n} ${n === 1 ? "вид" : n < 5 ? "види" : "видів"}`,
  commentsCount: (n: number) =>
    `${n} ${n % 10 === 1 && n % 100 !== 11 ? "коментар" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "коментарі" : "коментарів"}`,
  latestComment: (name: string) => `Новий коментар від ${name}:`,
  replyInFeed: "Відповісти у стрічці",
  commentsLabel: (count: number) => `Коментарі, ${count}`,
  save: "Зберегти в «Мій журнал»",
  saveLabel: (count: number) => (count > 0 ? `Зберегти в «Мій журнал». Зберегли: ${count}` : "Зберегти в «Мій журнал»"),
  saved: "Збережено в «Мій журнал»",
  unsaved: "Прибрано з «Мій журнал»",
  saveFailed: "Не вдалося зберегти.",
  share: "Поділитися",
  shareLabel: (count: number) => (count > 0 ? `Поділитися. Поділилися: ${count}` : "Поділитися"),
  shareCopy: "Скопіювати посилання",
  shareTelegram: "Надіслати в Telegram",
  shareMore: "Інші застосунки…",
  shareCopied: "Посилання скопійовано",
  shareFailed: "Не вдалося скопіювати посилання.",
  video: "відео",
  image: "зображення",
  minutes: "хв",

  composerLabel: "Новий допис",
  composerHint: "Це поле бачать лише автори.",
  composerPlaceholder: "Що хочете сказати учням?",
  topic: "Тема",
  topicHint: "обирає автор",
  attachBlock: "Блок з програми",
  attachProgram: "Програма",
  attachNone: "Без вкладення",
  pickCourse: "Програма",
  pickLesson: "Урок",
  pickBlock: "Блок",
  showFull: "Показувати у стрічці повністю",
  showFullHint: "інакше уривок і кнопка програми",
  publish: "Опублікувати",
  publishHint: "Виходить одразу, якщо проходить автоперевірку.",
  published: "Опубліковано у стрічці.",
  held: "Автоперевірка зупинила допис. Команда вирішить і відповість у «Мої дописи».",
  publishFailed: "Не вдалося опублікувати.",
  needTopic: "Оберіть тему допису.",
  needText: "Напишіть текст допису.",

  freshLabel: "Стрічка",
  freshTitle: "Свіже від авторів",
  freshLead: "Що автори CenterWay пишуть цього тижня: практики, думки, події.",
  freshAll: "Уся стрічка",
} as const;

/** «Сьогодні 10:40», «вчора», «3 дні тому», then a date. */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return "щойно";
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.round(hours / 24);
  if (days === 1) return "вчора";
  if (days < 7) return `${days} ${days < 5 ? "дні" : "днів"} тому`;
  return then.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
}
