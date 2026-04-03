export const DOSHA_TEST_SLUG = "dosha-test";

export const DOSHA_RESULT_TYPES = [
  "vata",
  "pitta",
  "kapha",
  "vata_pitta",
  "pitta_kapha",
  "vata_kapha",
  "tridosha",
] as const;

export type DoshaResultType = (typeof DOSHA_RESULT_TYPES)[number];
export type BaseDosha = "vata" | "pitta" | "kapha";

export type DoshaTestOptionSeed = {
  code: string;
  text: string;
  mappedDosha: BaseDosha;
  order: number;
};

export type DoshaTestQuestionSeed = {
  code: string;
  order: number;
  text: string;
  options: DoshaTestOptionSeed[];
};

export const DOSHA_TEST_VERSION = "v1";

export const DOSHA_TEST_QUESTIONS: DoshaTestQuestionSeed[] = [
  {
    code: "q01",
    order: 1,
    text: "Визначте себе та оберіть ваш варіант відповіді:",
    options: [
      { code: "q01_a1", text: "Дієте і рухаєтесь швидко", mappedDosha: "vata", order: 1 },
      { code: "q01_a2", text: "Дієте і рухаєтесь з середньою швидкістю", mappedDosha: "pitta", order: 2 },
      { code: "q01_a3", text: "Дієте і рухаєтесь повільно", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q02",
    order: 2,
    text: "Не любите яку погоду найбільше?",
    options: [
      { code: "q02_a1", text: "Не любите холодну погоду", mappedDosha: "vata", order: 1 },
      { code: "q02_a2", text: "Не любите спекотну погоду", mappedDosha: "pitta", order: 2 },
      { code: "q02_a3", text: "Не любите сиру погоду", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q03",
    order: 3,
    text: "Як ви описали б своє травлення?",
    options: [
      { code: "q03_a1", text: "Нерегулярне травлення, нерегулярний апетит", mappedDosha: "vata", order: 1 },
      { code: "q03_a2", text: "Сильне травлення", mappedDosha: "pitta", order: 2 },
      { code: "q03_a3", text: "Повільне травлення, помірний апетит", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q04",
    order: 4,
    text: "Як швидко ви засвоюєте нову інформацію?",
    options: [
      { code: "q04_a1", text: "Швидко вбираєте знання", mappedDosha: "vata", order: 1 },
      { code: "q04_a2", text: "Середній час вивчення", mappedDosha: "pitta", order: 2 },
      { code: "q04_a3", text: "Повільно сприймаєте інформацію", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q05",
    order: 5,
    text: "Як ви оцінюєте свою пам'ять?",
    options: [
      { code: "q05_a1", text: "Швидко забуваєте", mappedDosha: "vata", order: 1 },
      { code: "q05_a2", text: "Середня пам'ять", mappedDosha: "pitta", order: 2 },
      { code: "q05_a3", text: "Гарна пам'ять", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q06",
    order: 6,
    text: "Який емоційний стан вам ближчий?",
    options: [
      { code: "q06_a1", text: "Тривога, страх", mappedDosha: "vata", order: 1 },
      { code: "q06_a2", text: "Гнів, агресія", mappedDosha: "pitta", order: 2 },
      { code: "q06_a3", text: "Спокій, рівновага", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q07",
    order: 7,
    text: "Що найбільш відповідає вашому травному ритму?",
    options: [
      { code: "q07_a1", text: "Схильність до закрепів", mappedDosha: "vata", order: 1 },
      { code: "q07_a2", text: "М'який стул, схильність до діареї", mappedDosha: "pitta", order: 2 },
      { code: "q07_a3", text: "Нормальний стул, інколи схильність до закрепів", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q08",
    order: 8,
    text: "Який у вас сон?",
    options: [
      { code: "q08_a1", text: "Чуткий, поверхневий сон, 6-7 годин", mappedDosha: "vata", order: 1 },
      { code: "q08_a2", text: "Гарний сон, близько 8 годин", mappedDosha: "pitta", order: 2 },
      { code: "q08_a3", text: "Важкий, довгий сон з тривалим пробудженням", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q09",
    order: 9,
    text: "Як ви переносите навантаження?",
    options: [
      { code: "q09_a1", text: "Швидко втомлюєтесь, але швидко відновлюєтесь", mappedDosha: "vata", order: 1 },
      { code: "q09_a2", text: "Середня, планована витривалість", mappedDosha: "pitta", order: 2 },
      { code: "q09_a3", text: "Сильна витривалість, але з інертністю", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q10",
    order: 10,
    text: "Який опис волосся вам ближчий?",
    options: [
      { code: "q10_a1", text: "Хвилясте або ламке, може випадати, але швидко росте", mappedDosha: "vata", order: 1 },
      { code: "q10_a2", text: "Тонке, схильне до раннього посивіння", mappedDosha: "pitta", order: 2 },
      { code: "q10_a3", text: "Темне, густе волосся", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q11",
    order: 11,
    text: "Який стан шкіри вам більш типовий?",
    options: [
      { code: "q11_a1", text: "Суха шкіра, помітні судини та сухожилля", mappedDosha: "vata", order: 1 },
      { code: "q11_a2", text: "Шкіра чутлива до запалень/подразнень", mappedDosha: "pitta", order: 2 },
      { code: "q11_a3", text: "Масляниста, гладка шкіра", mappedDosha: "kapha", order: 3 },
    ],
  },
  {
    code: "q12",
    order: 12,
    text: "Яке співвідношення ваги до зросту вам ближче?",
    options: [
      { code: "q12_a1", text: "Легке, струнке тіло, вага частіше нижча за середню", mappedDosha: "vata", order: 1 },
      { code: "q12_a2", text: "Середня статура та середня вага", mappedDosha: "pitta", order: 2 },
      { code: "q12_a3", text: "Щільна статура, вага частіше вище за середню", mappedDosha: "kapha", order: 3 },
    ],
  },
];

export type DoshaScores = {
  vata: number;
  pitta: number;
  kapha: number;
};

function toDualResult(first: BaseDosha, second: BaseDosha): DoshaResultType {
  const pair = new Set<BaseDosha>([first, second]);
  if (pair.has("vata") && pair.has("pitta")) return "vata_pitta";
  if (pair.has("pitta") && pair.has("kapha")) return "pitta_kapha";
  if (pair.has("vata") && pair.has("kapha")) return "vata_kapha";
  throw new Error("Invalid dual dosha pair");
}

export function calculateDoshaResult(vata: number, pitta: number, kapha: number): DoshaResultType {
  const scores = [
    { key: "vata" as const, score: vata },
    { key: "pitta" as const, score: pitta },
    { key: "kapha" as const, score: kapha },
  ];

  const maxScore = Math.max(vata, pitta, kapha);
  const top = scores.filter((item) => item.score === maxScore).map((item) => item.key);

  if (top.length === 1) {
    const ranked = [...scores].sort((a, b) => b.score - a.score);
    const leader = ranked[0];
    const second = ranked[1];
    const third = ranked[2];

    // Product rule: if top two doshas form a 60/40-like split and the third is absent,
    // classify as dual dosha with a clear leader (canonical dual enum in storage).
    if (third.score === 0 && second.score > 0) {
      const topTwoTotal = leader.score + second.score;
      const leaderShare = topTwoTotal > 0 ? leader.score / topTwoTotal : 0;
      if (leaderShare >= 0.55 && leaderShare <= 0.65) {
        return toDualResult(leader.key, second.key);
      }
    }

    return top[0];
  }
  if (top.length === 3) return "tridosha";

  return toDualResult(top[0], top[1]);
}

export function isValidScoreInvariant(scores: DoshaScores, expectedSum: number): boolean {
  const sum = scores.vata + scores.pitta + scores.kapha;
  return sum === expectedSum;
}

export function doshaTagFromResult(result: DoshaResultType): string {
  return `dosha_${result}`;
}

export function asTestVersion(version: unknown): string {
  if (typeof version === "string" && version.trim()) return version.trim();
  return DOSHA_TEST_VERSION;
}
