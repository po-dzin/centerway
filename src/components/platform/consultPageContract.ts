/**
 * Content contract for the platform consultation page.
 *
 * The copy is adapted from the active consult funnel. Since 2026-10-16 the hub
 * holds no form: a request is always to one author, so it is left on that
 * author's page and the hub only helps a reader choose. Keeping the steps and answers as data lets the page structure be
 * checked without coupling the contract test to React markup.
 */
/**
 * The way a consultation goes, said from the author's page — where the request
 * is left. The reader has already chosen the person, so the steps start at the
 * request and stop at the plan.
 */
export const consultationSteps = [
  {
    id: "request",
    title: "Запит",
    text: "Ви описуєте, що хочете прояснити.",
  },
  {
    id: "time",
    title: "Час",
    text: "Ми пишемо вам і узгоджуємо зустріч.",
  },
  {
    id: "plan",
    title: "Розмова і план",
    text: "Пріоритети на 2–4 тижні.",
  },
] as const;

/**
 * The same way, said from `/consult`, where nobody has been chosen yet. One
 * step longer at the front: choosing the person is the first thing the hub
 * asks of a reader, and the request itself happens on that person's page.
 */
export const consultationHubSteps = [
  {
    id: "choose",
    title: "Оберіть автора",
    text: "Подивіться напрям, досвід і про що консультація.",
  },
  {
    id: "request",
    title: "Запит на сторінці автора",
    text: "Коротко опишіть, що хочете прояснити. Ми узгоджуємо зручний час онлайн.",
  },
  {
    id: "plan",
    title: "Розмова і план",
    text: "Після зустрічі у вас пріоритети на 2–4 тижні й зрозумілий наступний крок.",
  },
] as const;

export const consultationFaq = [
  {
    id: "online",
    question: "Це онлайн? Я не в Україні.",
    answer: "Так. Консультація проходить онлайн, а час узгоджуємо з урахуванням вашого часового поясу.",
  },
  {
    id: "choose",
    question: "Як обрати автора?",
    answer: "Подивіться, про що кожна консультація. Якщо вагаєтеся, почніть з тесту доші: він підкаже, з чого почати.",
  },
  {
    id: "prepare",
    question: "Що підготувати до зустрічі?",
    answer:
      "Достатньо коротко пригадати, що турбує, як давно і що ви вже пробували. Якщо приймаєте препарати або маєте хронічні стани, обов’язково скажіть про це.",
  },
  {
    id: "medical",
    question: "Це медичний прийом?",
    answer:
      "Ні. Це оздоровча консультація про спосіб життя, харчування і щоденний ритм. Вона не замінює діагностику, лікування або рекомендації лікаря.",
  },
  {
    id: "no-program",
    question: "А якщо мені не потрібна жодна з програм?",
    answer:
      "Тоді ви так і почуєте. Завдання консультації — визначити доречний наступний крок, а не обов’язково продати курс.",
  },
] as const;

export const consultationBoundary = {
  title: "Консультація не замінює медичну допомогу",
  text: "Ми працюємо з повсякденним ритмом, харчуванням і оздоровчими практиками. За гострих симптомів, хронічних станів або змін у лікуванні зверніться до профільного лікаря.",
} as const;
