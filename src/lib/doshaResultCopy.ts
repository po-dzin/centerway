/**
 * What the reader is told about their result — in one place.
 *
 * The screen is no longer the only thing that says it: the Telegram delivery
 * sends the same profile to the same person, and two copies of a verdict drift
 * into two different verdicts. Everything here is text ABOUT a result; nothing
 * here decides what the result is (that is `classifyDosha`).
 */

import { classifyDosha, type DoshaConfidence, type DoshaResultType } from "@/lib/doshaTest";

/* `title` asserts, `softTitle` suggests. Which one the result screen uses is
   decided by how far the scores sit from the nearest boundary, not by the type:
   5/4/3 and 12/0/0 used to be announced in the same voice. */
export const RESULT_COPY: Record<
  DoshaResultType,
  {
    title: string;
    softTitle: string;
    summary: string;
    recommendation: string;
    weekVector: string;
  }
> = {
  vata: {
    title: "Вата домінує",
    softTitle: "Схоже на вату",
    summary: "Ваш ритм швидкий і чутливий до змін, тому енергія може коливатися протягом дня.",
    recommendation: "Опора на стабільність: тепла їжа, прогнозований графік і спокійний вечірній ритуал.",
    weekVector: "7-денний вектор: тримайте однаковий час сну та 1 заземлюючу практику щодня.",
  },
  pitta: {
    title: "Пітта домінує",
    softTitle: "Схоже на пітту",
    summary: "Ваш профіль про інтенсивність і фокус, але ресурс відновлення потребує свідомих пауз.",
    recommendation: "Опора на баланс навантаження: охолоджувальні практики, короткі паузи, м'який темп у другій половині дня.",
    weekVector: "7-денний вектор: щодня плануйте 1 відновлювальну паузу до того, як з'явиться перевтома.",
  },
  kapha: {
    title: "Капха домінує",
    softTitle: "Схоже на капху",
    summary: "Ваш профіль дає стійкість і витривалість, але важливо підтримувати динаміку ритму.",
    recommendation: "Опора на активацію: ранній старт дня, динамічний рух і легкість у щоденному меню.",
    weekVector: "7-денний вектор: починайте ранок з 10-15 хвилин активного руху.",
  },
  vata_pitta: {
    title: "Вата + Пітта",
    softTitle: "Схоже на поєднання вати і пітти",
    summary: "Поєднання швидкості та інтенсивності: ідей багато, але ресурс потребує структурного режиму.",
    recommendation: "Опора на ритм і охолодження: чіткі блоки дня, паузи після піків навантаження.",
    weekVector: "7-денний вектор: щовечора фіксуйте 1 дію на відновлення перед сном.",
  },
  pitta_kapha: {
    title: "Пітта + Капха",
    softTitle: "Схоже на поєднання пітти і капхи",
    summary: "Поєднання сили реалізації та витривалості дає великий потенціал системних змін.",
    recommendation: "Опора на гнучкість: чергуйте інтенсивні й легкі дні, щоб зберігати стабільний прогрес.",
    weekVector: "7-денний вектор: використовуйте схему 2 дні активного фокусу + 1 день м'якого відновлення.",
  },
  vata_kapha: {
    title: "Вата + Капха",
    softTitle: "Схоже на поєднання вати і капхи",
    summary: "Поєднання чутливості та стійкості може змінювати ваш темп залежно від стану відновлення.",
    recommendation: "Опора на послідовність: простий режим, регулярний рух, підтримка енергії малими кроками.",
    weekVector: "7-денний вектор: оберіть 1 стабільну ранкову і 1 вечірню практику й тримайте їх щодня.",
  },
  tridosha: {
    title: "Трідоша",
    softTitle: "Профіль близький до рівноваги",
    summary: "Профіль показує близький баланс трьох дош, який добре підтримується системним ритмом.",
    recommendation: "Опора на адаптацію: коригуйте навантаження та відновлення відповідно до сезону і поточного стану.",
    weekVector: "7-денний вектор: щодня перевіряйте енергію та гнучко коригуйте інтенсивність дня.",
  },
};

/* One line each. They used to run two to three lines apiece, which put the
   start button below the fold on a phone — the steps were reassurance, and
   reassurance that costs the CTA its place stops reassuring anyone. */
export const HOW_IT_WORKS_STEPS = [
  "12 коротких питань про ритм, енергію, травлення, сон і напругу.",
  "Профіль доші як робоча гіпотеза про ваш поточний стан.",
  "Наступний крок: консультація, програма або самостійний старт.",
];

/* Three sentences that say the same thing at three strengths. The old screen
   had no third register at all: every result was reported as a dominance. */
export const CONFIDENCE_COPY: Record<DoshaConfidence, { label: string; note: string | null }> = {
  high: {
    label: "Профіль читається впевнено",
    note: null,
  },
  medium: {
    label: "Профіль читається, дві доші поруч",
    note: "Дві доші йдуть близько, тож за кілька тижнів іншого режиму результат може зміститися. Перечитайте його як напрямок, а не як мітку.",
  },
  low: {
    label: "Даних мало для впевненого профілю",
    note: "Ваші відповіді лягли майже порівну, тому це радше гіпотеза, ніж висновок. Пройдіть тест ще раз через 2-3 тижні або звіртеся на консультації — там стан читають разом із контекстом.",
  },
};

export const BOUNDARY_NOTE =
  "Це оздоровчий орієнтир, а не медичний діагноз. Результат не є медичним діагнозом і не замінює лікаря: якщо симптоми стійкі або гострі, спочатку варто пройти обстеження.";

export const DOSHA_DISCLOSURE =
  "У підході CenterWay доші описують природні патерни енергії, ритму й відновлення. Тест допомагає обрати доречні практики і матеріали в платформі.";

/**
 * The result as one block of plain text — what the Telegram delivery sends.
 *
 * Assembled here, from the same strings the screen renders, so the chat and the
 * page cannot come to say different things about the same twelve answers. The
 * caller passes the link, because where the reader is sent next is a routing
 * decision and this module only knows words.
 */
export function buildDoshaResultMessage(params: {
  resultType: DoshaResultType;
  scores: { vata: number; pitta: number; kapha: number };
  intro: string;
  outro: string;
  nextHref?: string | null;
}): string {
  const profile = classifyDosha(params.scores.vata, params.scores.pitta, params.scores.kapha);
  const copy = RESULT_COPY[params.resultType];
  const confidence = CONFIDENCE_COPY[profile.confidence];

  return [
    params.intro,
    "",
    profile.confidence === "low" ? copy.softTitle : copy.title,
    "",
    copy.summary,
    copy.recommendation,
    "",
    copy.weekVector,
    `Вата ${profile.shares.vata}% • Пітта ${profile.shares.pitta}% • Капха ${profile.shares.kapha}%`,
    `${confidence.label}.`,
    ...(confidence.note ? ["", confidence.note] : []),
    "",
    BOUNDARY_NOTE,
    "",
    params.outro,
    ...(params.nextHref ? [params.nextHref] : []),
  ].join("\n");
}
