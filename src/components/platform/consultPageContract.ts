/**
 * Content contract for the platform consultation page.
 *
 * The copy is adapted from the active consult funnel, but the route remains a
 * platform offer surface: one request form, no checkout and no cross-funnel
 * navigation. Keeping the steps and answers as data lets the page structure be
 * checked without coupling the contract test to React markup.
 */
export const consultationSteps = [
  {
    id: "request",
    title: "Запит",
    text: "Ви коротко описуєте, що хочете прояснити. Ми зв’язуємося і узгоджуємо зручний час онлайн-зустрічі.",
  },
  {
    id: "assessment",
    title: "Розбір стану",
    text: "На зустрічі розбираємо конституцію, травлення, сон, енергію, харчування та щоденний ритм як одну картину.",
  },
  {
    id: "plan",
    title: "Особистий план",
    text: "Після розмови у вас є пріоритети на 2-4 тижні і зрозумілий наступний крок: практика, програма або інша підтримка.",
  },
] as const;

export const consultationExpectations = [
  "онлайн-зустріч тривалістю до 90 хвилин",
  "розбір поточного стану, конституції, харчування і ритму",
  "персональні пріоритети та план дій на 2-4 тижні",
] as const;

export const consultationFaq = [
  {
    id: "online",
    question: "Це онлайн? Я не в Україні.",
    answer: "Так. Консультація проходить онлайн, а час узгоджуємо з урахуванням вашого часового поясу.",
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
