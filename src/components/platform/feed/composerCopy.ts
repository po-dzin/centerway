/**
 * The composer's words (Ukrainian), apart from `copy.ts` so the feed's card
 * and the composer can change in parallel. A change here is a copy change and
 * waits for G's yes like any other.
 */

export const composerCopy = {
  open: "Новий допис",
  title: "Новий допис",
  titleAgain: "Надіслати ще раз",
  close: "Закрити",
  discard: "Закрити допис? Написане не збережеться.",

  topics: "Тема",
  topicsLabel: "Теми допису, до трьох",
  topicsHint: "До трьох тем. Перша — головна.",
  topicsFull: "Вже три теми — зніміть одну, щоб обрати іншу.",

  placeholder: "Що нового?",
  textLabel: "Текст допису",
  attached: "Додано до допису",

  fmtLabel: "Форматування",
  bold: "Жирний",
  italic: "Курсив",
  link: "Посилання",
  list: "Список",
  ordered: "Нумерований список",
  quote: "Цитата",
  linkPlaceholder: "https://…",
  linkAdd: "Додати",
  linkInvalid: "Посилання має починатися з https://",
  fmtHint: "Виділіть слова, щоб оформити їх.",

  toolsLabel: "Додати до допису",
  photo: "Фото",
  video: "Відео за посиланням",
  audio: "Аудіо: записати або завантажити",
  block: "Блок з програми",
  program: "Програма",

  photoActions: (n: number) => `Дії з фото ${n}`,
  photoAlt: (n: number) => `Фото ${n}`,
  spoilerOn: "Сховати як спойлер",
  spoilerOff: "Показувати одразу",
  spoilerBadge: "спойлер",
  removePhoto: "Прибрати",
  photosFull: (max: number) => `До ${max} фото в одному дописі.`,
  photoUploading: "Завантажується",
  photoFailed: "Не вдалося завантажити фото.",
  retry: "Ще раз",

  videoPlaceholder: "Посилання на YouTube",
  videoAdd: "Додати",
  videoInvalid: "Це не схоже на посилання YouTube.",
  videoRemove: "Прибрати відео",
  videoChip: "YouTube",

  audioRecord: "Записати",
  audioStop: "Зупинити",
  audioPick: "Вибрати файл",
  audioRecording: "Запис",
  audioRemove: "Прибрати аудіо",
  audioUploading: "Завантажується аудіо",
  audioFailed: "Не вдалося завантажити аудіо.",
  audioTooBig: "Аудіо до 20 МБ.",
  audioTooLong: "Аудіо до 10 хвилин.",
  audioType: "Підходять m4a, mp3, webm або ogg.",
  micDenied: "Немає доступу до мікрофона. Можна вибрати файл.",
  micMissing: "Цей браузер не записує звук. Можна вибрати файл.",
  audioLimitHint: "до 10 хв",

  tagWith: "з",
  tagAdd: "автора",
  tagLabel: "Позначити авторів",
  tagFind: "Знайти автора",
  tagNone: "Нікого не знайдено.",
  tagNote: "Позначити можна лише авторів CenterWay, до трьох.",
  tagRemove: (name: string) => `Прибрати позначку: ${name}`,

  pickCourse: "Програма",
  pickLesson: "Урок",
  pickBlock: "Блок",
  noBlocks: "У цій програмі поки немає блоків.",
  showFull: "Показувати у стрічці повністю",
  showFullHint: "інакше уривок і стрілка до програми",
  removeAttach: "Прибрати вкладення",
  attachDone: "Прикріпити",
  attachChange: "Змінити",
  blockFrom: "Блок з програми",
  programWhole: "Програма",

  publish: "Опублікувати",
  publishing: "Публікуємо…",
  waitUploads: "Зачекайте, файли ще завантажуються.",
  shortcut: "Ctrl + Enter",
  published: "Опубліковано у стрічці.",
  held: "Автоперевірка зупинила допис. Команда вирішить і відповість у «Мої дописи».",
  heldTitle: "Допис чекає команду",
  heldLead: "Автоперевірка зупинила його ось чому. Команда вирішить і відповість у «Мої дописи».",
  heldClose: "Зрозуміло",
  publishFailed: "Не вдалося опублікувати.",
  needTopic: "Оберіть тему допису.",
  needText: "Напишіть текст допису.",
  tooLong: (max: number) => `Допис до ${max} знаків.`,

  errors: {
    media_invalid: "Не вдалося прикріпити файли. Спробуйте прибрати й додати їх знову.",
    media_too_many_photos: "До 10 фото в одному дописі.",
    media_video_invalid: "Посилання на відео не підходить.",
    media_audio_too_long: "Аудіо до 10 хвилин.",
    media_too_large: "Файл завеликий.",
    media_unsupported_type: "Такий файл не підходить.",
    media_not_an_image: "Це не схоже на фото.",
    media_not_audio: "Це не схоже на аудіо.",
    topic_invalid: "Оберіть від однієї до трьох тем.",
    tags_invalid: "Позначити можна лише авторів CenterWay.",
    tags_too_many: "Позначити можна до трьох авторів.",
    body_invalid: "Напишіть текст допису.",
    body_too_long: "Допис задовгий.",
    attachment_not_yours: "Прикріпити можна лише свою програму.",
    attachment_invalid: "Вкладення не знайдено. Оберіть його ще раз.",
    rate_limited: "Забагато спроб. Спробуйте за хвилину.",
    network: "Немає з’єднання. Спробуйте ще раз.",
  } as Record<string, string>,
} as const;

/** «1:05» — minutes and seconds of an audio. */
export function clockOf(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
