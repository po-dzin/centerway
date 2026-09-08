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

/* WHAT THE READER WAS ASKED, not what we did with the answers.
   `v2` is the 2026-09 rewrite of all twelve questions and their options. The
   axes, their order and every option's `mappedDosha` are unchanged, so scores
   from v1 and v2 are structurally comparable — but the wording a person read
   is not the same wording, and an attempt records which one it was. Codes are
   deliberately untouched: `test_answers` points at option rows by id, and new
   codes would seed a second copy of the test beside the first. */
export const DOSHA_TEST_VERSION = "v2";

export const DOSHA_TEST_QUESTIONS: DoshaTestQuestionSeed[] = [
  {
    code: "q01",
    order: 1,
    text: "Який ваш природний темп у щоденних справах та рухах?",
    options: [
      {
        code: "q01_a1",
        text: "Швидкий та енергійний. Я дію швидко, іноді метушливо, часто поспішаю.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q01_a2",
        text: "Помірний та чіткий. Мій темп впевнений і цілеспрямований, без зайвої суєти.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q01_a3",
        text: "Розмірений та спокійний. Я рухаюся неквапливо і плавно, зберігаючи внутрішній спокій.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q02",
    order: 2,
    text: "Яку погоду ви переносите найгірше?",
    options: [
      {
        code: "q02_a1",
        text: "Я дуже швидко мерзну, тому найбільше не люблю холод, вітер і протяги.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q02_a2",
        text: "Я швидко перегріваюся, тому найгірше переношу спеку та палюче сонце.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q02_a3",
        text: "Мене пригнічує сирість і волога прохолода, не люблю похмурі та дощові дні.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q03",
    order: 3,
    text: "Як би ви описали свій апетит та травлення?",
    options: [
      {
        code: "q03_a1",
        text: "Мій апетит постійно змінюється (можу забути поїсти або перекушую на ходу). Травлення чутливе та нерегулярне.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q03_a2",
        text: "У мене завжди сильний апетит — мені важко терпіти голод. Травлення швидке та активне.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q03_a3",
        text: "Апетит слабкий або помірний. Травлення повільне, після їжі часто з'являється відчуття важкості.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q04",
    order: 4,
    text: "Як швидко ви розумієте та засвоюєте нову інформацію?",
    options: [
      {
        code: "q04_a1",
        text: "Я дуже швидко розумію нове, миттєво вловлюю ідеї, хоч іноді й поверхнево.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q04_a2",
        text: "Я швидко розбираюся в темі, але мені важливо зрозуміти систему, структуру та логіку.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q04_a3",
        text: "Мені потрібен час, щоб вникнути. Я сприймаю інформацію неквапливо, бо люблю розбиратися глибоко.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q05",
    order: 5,
    text: "Як довго ви зазвичай утримуєте інформацію в пам'яті?",
    options: [
      {
        code: "q05_a1",
        text: "У мене хороша короткочасна пам'ять, але з часом я легко забуваю деталі чи події.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q05_a2",
        text: "У мене ясна та чітка пам'ять. Я легко запам'ятовую потрібну інформацію, імена, дати чи факти.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q05_a3",
        text: "Мені потрібен час, щоб щось вивчити, але те, що я запам'ятав(ла), залишається зі мною надовго.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q06",
    order: 6,
    text: "Яка ваша типова емоційна реакція на труднощі або втому?",
    options: [
      {
        code: "q06_a1",
        text: "Я часто хвилююся, багато думаю про проблеми, схильний(а) до тривоги та сумнівів.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q06_a2",
        text: "Я легко дратуюся, можу бути нетерплячим(ою) або різким(ою), коли щось іде не за планом.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q06_a3",
        text: "Зазвичай я зберігаю спокій та врівноваженість, але іноді можу відчувати апатію чи лінощі.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q07",
    order: 7,
    text: "Як зазвичай працює ваш кишечник?",
    options: [
      {
        code: "q07_a1",
        text: "Робота кишечника нерегулярна. Часто бувають закрепи, відчуття сухості або здуття.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q07_a2",
        text: "Кишечник працює дуже активно і швидко. Випорожнення часті, м'які, є схильність до розладів.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q07_a3",
        text: "Кишечник працює стабільно і регулярно. Але іноді процес може бути повільним, з відчуттям важкості.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q08",
    order: 8,
    text: "Як би ви описали свій сон та пробудження?",
    options: [
      {
        code: "q08_a1",
        text: "Мій сон часто чуткий та неспокійний. Мені буває важко заснути через думки, або прокидаюсь уночі.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q08_a2",
        text: "Я сплю міцно і висипаюся за 7–8 годин. Швидко засинаю і прокидаюсь бадьорим(ою).",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q08_a3",
        text: "У мене дуже глибокий сон, люблю спати довго. Зранку мені потрібно багато часу на розкачку.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q09",
    order: 9,
    text: "Як би ви оцінили свій рівень енергії та фізичної витривалості?",
    options: [
      {
        code: "q09_a1",
        text: "Моя енергія нестабільна. Я дію спалахами: можу бути дуже активним(ою), але швидко втомлююсь.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q09_a2",
        text: "У мене хороший запас енергії та витривалість, але є схильність заганяти себе до виснаження.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q09_a3",
        text: "У мене висока витривалість. Важко почати, але якщо втягнувся(лась), можу працювати довго і стабільно.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q10",
    order: 10,
    text: "Як би ви описали своє волосся від природи?",
    options: [
      {
        code: "q10_a1",
        text: "Від природи сухе, схильне до ламкості та посічених кінчиків. Часто неслухняне або пухнасте.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q10_a2",
        text: "Тонке, м'яке і пряме. Є схильність до раннього посивіння або порідіння.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q10_a3",
        text: "Дуже густе, міцне і блискуче. Добре росте, але може бути важким.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q11",
    order: 11,
    text: "Який стан шкіри для вас найбільш характерний?",
    options: [
      {
        code: "q11_a1",
        text: "Шкіра переважно суха, тонка (крізь неї можуть просвічувати вени), легко мерзне.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q11_a2",
        text: "Шкіра чутлива, тепла. Легко червоніє на сонці чи від емоцій, бувають подразнення чи висипання.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q11_a3",
        text: "Шкіра приємна на дотик, щільна та гладка. Добре утримує вологу, але іноді схильна до жирності.",
        mappedDosha: "kapha",
        order: 3,
      },
    ],
  },
  {
    code: "q12",
    order: 12,
    text: "Як би ви описали свою природну статуру?",
    options: [
      {
        code: "q12_a1",
        text: "Від природи тонка, худорлява статура та легка кістка. Важко набираю вагу.",
        mappedDosha: "vata",
        order: 1,
      },
      {
        code: "q12_a2",
        text: "Збалансована, пропорційна статура (часто спортивна). Вага стабільна, легко керувати нею.",
        mappedDosha: "pitta",
        order: 2,
      },
      {
        code: "q12_a3",
        text: "Міцна тілобудова, широка кістка. Швидко набираю вагу, іноді важко її позбутися.",
        mappedDosha: "kapha",
        order: 3,
      },
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

export type DoshaConfidence = "high" | "medium" | "low";

/* THE THREE THRESHOLDS, IN PERCENTAGE POINTS OF THE WHOLE SCORE.
   Counts are not comparable between test versions (12 items now, weighted
   items later), so every boundary below is expressed as a share of the total.

   - A profile whose leader stands no further than a sixth of the scale above
     its weakest dosha is not a profile with a leader: that is tridosha.
   - Above that, the leader owns the pair or shares it: 65/35 is the line.
     Anything flatter than 65/35 reads as a dual dosha, anything steeper as a
     single one. */
export const DOSHA_TRIDOSHA_SPREAD_MAX_PP = 100 / 6;
export const DOSHA_DUAL_LEADER_SHARE_MAX_PP = 65;

/* Distance from the nearest boundary that would flip the answer. A result
   sitting one hair from a different verdict is reported as such instead of
   being asserted in the same voice as 12/0/0. */
export const DOSHA_CONFIDENCE_HIGH_PP = 10;
export const DOSHA_CONFIDENCE_MEDIUM_PP = 4;

export type DoshaShares = {
  vata: number;
  pitta: number;
  kapha: number;
};

export type DoshaClassification = {
  type: DoshaResultType;
  /** Each dosha as a share of the total score, in percentage points. */
  shares: DoshaShares;
  /** Leader's share of the top two, in percentage points — the 65/35 axis. */
  leaderSharePp: number;
  /** Leader minus the weakest dosha, in percentage points — the tridosha axis. */
  spreadPp: number;
  /** Distance to the nearest boundary that would change `type`. */
  marginPp: number;
  confidence: DoshaConfidence;
};

function roundPp(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Reads a score triple as a profile: which type, how flat, and how firmly.
 *
 * Every triple lands in exactly one of three cases — flat (tridosha), a pair
 * (dual), or a leader (single) — so no combination is unreachable and none is
 * reachable by accident. The previous rule classified duals only on an exact
 * tie or on a third dosha of exactly zero, which on twelve questions left
 * tridosha achievable at 4/4/4 alone and gave a softer verdict to the more
 * lopsided of two neighbouring splits.
 */
export function classifyDosha(vata: number, pitta: number, kapha: number): DoshaClassification {
  const total = vata + pitta + kapha;
  const ranked = [
    { key: "vata" as const, score: vata },
    { key: "pitta" as const, score: pitta },
    { key: "kapha" as const, score: kapha },
  ].sort((a, b) => b.score - a.score);

  const [leader, second, third] = ranked;

  if (total <= 0) {
    return {
      type: "tridosha",
      shares: { vata: 0, pitta: 0, kapha: 0 },
      leaderSharePp: 0,
      spreadPp: 0,
      marginPp: 0,
      confidence: "low",
    };
  }

  const shares: DoshaShares = {
    vata: roundPp((vata / total) * 100),
    pitta: roundPp((pitta / total) * 100),
    kapha: roundPp((kapha / total) * 100),
  };

  const spreadPp = ((leader.score - third.score) / total) * 100;
  const topTwo = leader.score + second.score;
  const leaderSharePp = topTwo > 0 ? (leader.score / topTwo) * 100 : 50;

  /* A leader tied with BOTH runners-up has no pair to belong to: there is no
     way to say which dosha joins it, so it stays single and the 65/35 axis
     does not apply to its confidence. */
  const pairIsDefined = second.score > third.score;

  let type: DoshaResultType;
  if (spreadPp <= DOSHA_TRIDOSHA_SPREAD_MAX_PP) {
    type = "tridosha";
  } else if (pairIsDefined && leaderSharePp <= DOSHA_DUAL_LEADER_SHARE_MAX_PP) {
    type = toDualResult(leader.key, second.key);
  } else {
    type = leader.key;
  }

  const distanceToTridosha = Math.abs(spreadPp - DOSHA_TRIDOSHA_SPREAD_MAX_PP);
  const distanceToDualLine = pairIsDefined
    ? Math.abs(leaderSharePp - DOSHA_DUAL_LEADER_SHARE_MAX_PP)
    : Number.POSITIVE_INFINITY;

  const marginPp =
    type === "tridosha" ? distanceToTridosha : Math.min(distanceToTridosha, distanceToDualLine);

  const confidence: DoshaConfidence =
    marginPp >= DOSHA_CONFIDENCE_HIGH_PP
      ? "high"
      : marginPp >= DOSHA_CONFIDENCE_MEDIUM_PP
        ? "medium"
        : "low";

  return {
    type,
    shares,
    leaderSharePp: roundPp(leaderSharePp),
    spreadPp: roundPp(spreadPp),
    marginPp: roundPp(marginPp),
    confidence,
  };
}

export function calculateDoshaResult(vata: number, pitta: number, kapha: number): DoshaResultType {
  return classifyDosha(vata, pitta, kapha).type;
}

/* WHAT THE BROWSER IS ALLOWED TO KNOW ABOUT A QUESTION.
   The definition used to ship `mappedDosha` with every option, so the answer
   key travelled to the client, and `order` was the seed order — vata first,
   pitta second, kapha third, in all twelve questions. The first fact is an
   invitation to game the test; the second is a primacy effect baked into the
   instrument, because the same dosha always sat under the thumb. */
export type PublicTestOption = {
  id: string;
  order: number;
  code: string;
  text: string;
};

export type PublicTestQuestion = {
  id: string;
  orderIndex: number;
  code: string;
  text: string;
  options: PublicTestOption[];
};

type SourceQuestion = {
  id: string;
  orderIndex: number;
  code: string;
  text: string;
  options: Array<{ id: string; order: number; code: string; text: string }>;
};

function hash32(input: string): number {
  // FNV-1a: short, dependency-free, and stable across runtimes — the order has
  // to come out the same on every request for a given session.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Orders each question's options by a seed derived from the session, and drops
 * everything the browser has no use for.
 *
 * Seeded rather than random: a person walking back through their answers must
 * find them where they left them, and a second request for the same session
 * has to return the same arrangement. Different sessions get different orders,
 * which is what takes the position bias out of the aggregate.
 */
export function presentQuestionsForSession(
  questions: SourceQuestion[],
  sessionId: string
): PublicTestQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    orderIndex: question.orderIndex,
    code: question.code,
    text: question.text,
    options: shuffleWithSeed(question.options, hash32(`${sessionId}:${question.code}`)).map(
      (option, index) => ({
        id: option.id,
        // The position on screen, not the seed order — the seed order is the key.
        order: index + 1,
        code: option.code,
        text: option.text,
      })
    ),
  }));
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
