/**
 * Every word of the cycle and «Мій ритм» (G 23.10), carried over from the
 * autumn programme's prototype into Ukrainian. The voice is not final: a copy
 * change here waits for G's yes like any other.
 */

import type { BlockLever, CyclePhase, DayTypeId } from "@/lib/profile/cycle";
import type { ProfileLang } from "@/components/platform/profile/types";

export type CyclePhaseCopy = { name: string; dates: string; out: string; tasks: string[] };

const UK = {
  phases: {
    see: {
      name: "Побачити А",
      dates: "9–13.11",
      out: "Карта поточного стану",
      tasks: [
        "Оцініть кожну сферу від 0 до 10 такою, якою вона є зараз, а не якою має бути.",
        "До кожної оцінки запишіть один живий приклад з останнього тижня.",
        "Здоров'я перевірте в трьох вимірах: тіло, психіка, зв'язки.",
        "На сесії 9.11 покажіть карту групі або ведучому і поправте, де себе прикрасили.",
      ],
    },
    choose: {
      name: "Обрати Б",
      dates: "14–16.11",
      out: "Напрямок на рік",
      tasks: [
        "Поставте, де хочете бути в кожній сфері через рік.",
        "Питання фази: що б ви робили з необмеженими ресурсами й часом?",
        "Не ставте всюди 10: Б задає напрямок, а не ідеал.",
        "Сфери з розривом від 3 стануть кандидатами у фокус.",
      ],
    },
    bridge: {
      name: "Збудувати міст",
      dates: "17–22.11",
      out: "Моя система v0.1",
      tasks: [
        "Оберіть 2–3 сфери фокусу, не більше трьох.",
        "Для кожної розкладіть шлях: рік → місяць → тиждень → день.",
        "Назвіть, що заважає і що підтримує: середовище, тіло, харчування, увага, люди.",
        "Крок дня поставте блоком у «Мій ритм» і зберіть свої типи дня.",
      ],
    },
    live: {
      name: "Прожити",
      dates: "23–29.11",
      out: "Сліди тижня",
      tasks: [
        "Сім днів живете на своїх типах дня.",
        "Відмічайте день, коли крок зроблено. Пропуск теж дані, а не провал.",
        "Зранку і ввечері коротка нотатка, без оцінок «впорався чи ні».",
        "24.11, у повню, звірка в групі на середині експерименту.",
      ],
    },
    rebuild: {
      name: "Пересібрати",
      dates: "30.11–9.12",
      out: "Моя система v1.0",
      tasks: [
        "Переоцініть сфери: де ви зараз, точка А′.",
        "Дайте відповідь на три питання: що спрацювало, що ні, що змінити.",
        "Оновіть кроки мосту і типи дня.",
        "9.12 покажіть v1.0 і оберіть фокус наступного циклу.",
      ],
    },
  } satisfies Record<CyclePhase, CyclePhaseCopy>,
  phasesLabel: "Фаза циклу",
  phaseTasks: (name: string, dates: string) => `Завдання фази «${name}» · ${dates}`,
  phaseOut: (out: string) => `Підсумок фази: ${out}.`,
  anchors: "0 криза · 3 часто бракує · 5 терпимо · 7 добре · 10 краще не уявляю",
  fieldLabel: { now: "зараз, А", goal: "через рік, Б", after: "після циклу, А′" },
  keyNow: "А, зараз",
  keyGoal: "Б, через рік",
  keyAfter: "А′, після циклу",
  hintLive: (field: string) =>
    `Тягніть точки по осях або натисніть на вісь, щоб поставити «${field}». Повзунок біля кожної сфери робить те саме.`,
  hintStill: "У цій фазі карта лише для звірки. Оцінки змінюються у вкладках «Побачити А», «Обрати Б» і «Пересібрати».",
  radarLabel: "Павутина сфер: точки можна тягнути по осях",
  gap: (value: number) => `розрив ${value > 0 ? "+" : ""}${value}`,
  gapAfter: (value: number) => `до Б ${value > 0 ? "+" : ""}${value}`,
  unset: "—",
  rename: "Назва сфери",
  grip: (name: string) => `Перетягнути сферу «${name}»; стрілки вгору і вниз змінюють порядок осей`,
  hide: (name: string) => `Прибрати сферу «${name}»`,
  addSphere: "Додати сферу",
  examplePlaceholder: "Живий приклад з останнього тижня",
  exampleLabel: (name: string) => `Приклад для сфери «${name}»`,
  goalPlaceholder: "Якою буде ця сфера через рік",
  goalLabel: (name: string) => `Ціль через рік для сфери «${name}»`,
  focusPick: "Сфери фокусу",
  focusEmpty: "Оберіть сфери фокусу вище.",
  focusFirst: "Спершу оберіть фокус у фазі «Збудувати міст».",
  bridgeGoal: "Б, через рік",
  bridgeWeek: "Крок тижня",
  bridgeWeekPlaceholder: "Що зроблю за цей тиждень",
  bridgeDay: "Крок дня",
  bridgeAfter: "Після",
  bridgeAfterPlaceholder: "ранкової склянки води",
  bridgeStep: "я",
  bridgeStepPlaceholder: "20 хвилин йоги",
  bridgeMinutes: "хв",
  toRhythm: "Поставити кроки в день",
  toRhythmNote: "Крок дня з'явиться в «Мій ритм», у рядку «Фокус дня».",
  weekDays: ["пн 23", "вт 24", "ср 25", "чт 26", "пт 27", "сб 28", "нд 29"],
  daysOf: (count: number) => `${count} з 7 днів`,
  stepOf: (text: string) => `Крок дня: ${text}`,
  stepUnset: "не задано у фазі «Міст»",
  review: { worked: "Що спрацювало", didnt: "Що не спрацювало", change: "Що змінити" },
  summary: (count: number, a: string, b: string | null, after: string | null) =>
    `${count} сфер · середнє А ${a}${b ? ` · Б ${b}` : ""}${after ? ` · А′ ${after}` : ""}`,
  footer: "Назви сфер можна змінити, сфери можна прибрати або повернути. Карту бачите тільки ви.",

  rhythmTitle: "Мій ритм",
  rhythmLead:
    "Готового режиму немає. Оберіть тип дня, скажіть, скільки часу маєте вранці й увечері, і зберіть слоти з блоків. Вгорі «Фокус дня»: крок дня кожної сфери фокусу з карти, він ставиться у слот одним натиском.",
  dayTypesLabel: "Тип дня",
  dayTypes: {
    full: { name: "Повний", hint: "~9 годин роботи трьома блоками. На себе лишається година вранці й година ввечері." },
    avg: {
      name: "Середній",
      hint: "~6 годин роботи. Ранковий і вечірній блоки від 30 хвилин до 2 годин, скільки оберете.",
    },
    min: { name: "Мінімальний", hint: "3–4 години роботи. Вільний блок іде на хобі, людей або рух." },
    off: { name: "Вихідний", hint: "Без роботи, без плану і без трекінгу. Сире поле, яке тримає в системі життя." },
  } satisfies Record<DayTypeId, { name: string; hint: string }>,
  slots: {
    morning: "Ранок до їжі",
    work: "Робота",
    evening: "Вечір після їжі",
    people: "Люди",
    free: "Вільний блок",
  } as Record<string, string>,
  budgetOf: "з",
  minutesShort: "хв",
  collected: (text: string, over: boolean) => `${text} зібрано${over ? " · більше, ніж є" : ""}`,
  emptySlot: "Порожньо. Оберіть слот і додайте блоки.",
  offDay: "У вихідний конструктор не потрібен. Це день без розкладу.",
  removeBlock: (name: string) => `Прибрати «${name}»`,
  blocksTitle: "Блоки",
  addsTo: (slot: string) => `Додається у слот «${slot}»`,
  offNoBlocks: "У вихідний блоки не додаються",
  total: (all: string, mine: string) => `Усього зібрано ${all} · на себе ${mine}`,
  focusDay: "Фокус дня",
  focusDayCount: (done: number, all: number) => `${done} з ${all} у дні`,
  focusDayEmpty: "Фокус дня з'явиться, коли в карті у фазі «Збудувати міст» будуть обрані сфери фокусу і кроки дня.",
  stepUnsetShort: "крок дня не задано",
  toSlot: (slot: string) => `У слот «${slot}»`,
  removeFromDay: "Прибрати з дня",
  fromMap: "З карти сфер",
  resetExample: "Повернути приклад",
  toMap: "До карти сфер",
  focusGoal: (text: string) => `Б: ${text}`,
  focusWeek: (text: string) => `тиждень: ${text}`,
  after: (text: string) => `після ${text} → `,
  rule: "Блок до їжі вранці і блок після їжі ввечері — єдині особисті години на добу, тож їх бережуть. Тиждень складається з типів дня. Не вклався — змінюємо конструкцію, а не сваримо себе.",
  levers: {
    body: "Тіло",
    state: "Стан",
    food: "Харчування",
    env: "Середовище",
    rhythm: "Ритм",
    dir: "Напрямок",
    people: "Люди і хобі",
  } satisfies Record<BlockLever, string>,
  blocks: {
    "yoga-record": "Йога із запису",
    "yoga-live": "Йога-ефір",
    exercise: "Зарядка",
    walk: "Прогулянка",
    "breath-5x5": "Дихання 5×5",
    meditation: "Медитація",
    "meditation-live": "Ефір медитації",
    "warm-breakfast": "Теплий сніданок",
    "main-meal": "Головний прийом їжі",
    "light-dinner": "Легка вечеря",
    "food-note": "Нотатка про раціон",
    "light-air": "Світло і свіже повітря",
    "screen-free-evening": "Вечір без екранів",
    "tidy-one-place": "Розібрати одне місце",
    "morning-questions": "Ранкові питання",
    "evening-review": "Вечірній розбір",
    "week-planning": "Планування тижня",
    "work-block": "Робочий блок",
    "step-to-b": "Крок до точки Б",
    creative: "Творчість",
    "close-people": "Час з близькими",
    hobby: "Хобі",
  } as Record<string, string>,
  duration: (minutes: number) =>
    minutes >= 60 ? `${Math.floor(minutes / 60)} год${minutes % 60 ? ` ${minutes % 60} хв` : ""}` : `${minutes} хв`,
};

export type CycleCopy = typeof UK;

export function getCycleCopy(lang: ProfileLang): CycleCopy {
  void lang;
  // The programme runs in Ukrainian; an English reader gets the same words for now.
  return UK;
}
