/**
 * The balance test — «Внутрішній простір і баланс дош».
 *
 * WHAT IT READS, AND HOW IT DIFFERS FROM THE DOSHA TEST. The dosha test reads
 * constitution: the pattern a person is built on, stable over years. This one
 * reads the present state — which element has left its banks right now, and
 * whether the system is holding together at all. That is why every question
 * here has a fourth answer the dosha test does not: `balance`, the reading
 * that nothing is out of line in this part of life.
 *
 * WHY IT LIVES IN CODE AND NOT IN `test_questions`. The dosha tables are the
 * dosha test's own instrument: `test_options.mapped_dosha` and
 * `dosha_result_type` admit three doshas and seven profiles, and `balance` is
 * neither. Widening those constraints would let a balance answer into the
 * dosha test's arithmetic. The test's row in `test_definitions` exists only to
 * carry its author, exactly as the dosha test's does.
 *
 * The questions and result copy are the author's (2026-09-26 doc), moved into
 * «ви» — the one register the platform speaks in — and out of gendered
 * adjectives, which a first-person answer the reader signs cannot guess.
 */

export const BALANCE_TEST_SLUG = "balance-test";
export const BALANCE_TEST_VERSION = "v1";

export const BALANCE_TYPES = ["balance", "vata", "pitta", "kapha"] as const;
export type BalanceType = (typeof BALANCE_TYPES)[number];
export type BalanceDosha = Exclude<BalanceType, "balance">;

export type BalanceOption = { code: string; text: string; type: BalanceType };

export type BalanceQuestion = {
  code: string;
  /** The part of life the question looks at — the eyebrow above it. */
  topic: string;
  text: string;
  /** Seed order: balance, vata, pitta, kapha. Never the order on screen. */
  options: readonly BalanceOption[];
};

export const BALANCE_QUESTIONS: readonly BalanceQuestion[] = [
  {
    code: "b01",
    topic: "Ранок і пробудження",
    text: "Коли ви прокидаєтеся і робите перший рух після сну, яким є стан тіла і свідомості?",
    options: [
      {
        code: "b01_balance",
        type: "balance",
        text: "Ранки легкі й ясні: прокидаюся з ясною головою, тіло гнучке і готове до дня.",
      },
      {
        code: "b01_vata",
        type: "vata",
        text: "У голові легкий вітер, думки вже кудись біжать, шкіра чи губи сухі, а тілу потрібен час, щоб зібратися докупи.",
      },
      {
        code: "b01_pitta",
        type: "pitta",
        text: "Ранки часом напружені: сухість у роті або легкий жар, на язиці жовтуватий наліт.",
      },
      {
        code: "b01_kapha",
        type: "kapha",
        text: "Прокидатися важко: тіло скуте, в голові туман, на язиці щільний білий наліт.",
      },
    ],
  },
  {
    code: "b02",
    topic: "Вогонь травлення · агні",
    text: "Що відбувається всередині після того, як ви поїли?",
    options: [
      {
        code: "b02_balance",
        type: "balance",
        text: "Травлення працює рівно і тихо. Відчуваю легке тепло і приплив сил без важкості.",
      },
      {
        code: "b02_vata",
        type: "vata",
        text: "Травлення непередбачуване: то здуття, то легкий спазм, то відчуття порожнечі чи неспокою в животі.",
      },
      {
        code: "b02_pitta",
        type: "pitta",
        text: "Після їжі — жар, печія, різкий спад енергії або внутрішнє подразнення.",
      },
      {
        code: "b02_kapha",
        type: "kapha",
        text: "Їжа наче застрягає всередині: важкість, млявість і непереборне бажання полежати чи поспати.",
      },
    ],
  },
  {
    code: "b03",
    topic: "Смак і відчуття впродовж дня",
    text: "Як почуваються тіло і внутрішній простір серед дня?",
    options: [
      {
        code: "b03_balance",
        type: "balance",
        text: "У роті свіжість і чистота, смак природний, у тілі — рівна енергія.",
      },
      {
        code: "b03_vata",
        type: "vata",
        text: "У роті часто сухо, губи тріскаються, у тілі легка нервозність, а сила то є, то зникає.",
      },
      {
        code: "b03_pitta",
        type: "pitta",
        text: "Часом з'являється кислуватий, гіркий чи металевий присмак, відчуття внутрішнього тепла або печіння.",
      },
      {
        code: "b03_kapha",
        type: "kapha",
        text: "Відчувається липкість, солодкуватий чи в'язкий присмак, а тілу бракує легкості — ніби невидима плівка.",
      },
    ],
  },
  {
    code: "b04",
    topic: "Розум і сприйняття",
    text: "Подивіться на свій теперішній потік думок і на те, як ви сприймаєте світ.",
    options: [
      {
        code: "b04_balance",
        type: "balance",
        text: "Розум чистий і спокійний, фокус тримається легко, дрібниці не вибивають з рівноваги.",
      },
      {
        code: "b04_vata",
        type: "vata",
        text: "Розум як осіннє листя на вітрі: багато ідей, швидкі переключення, часом тривога і важко заснути через потік думок.",
      },
      {
        code: "b04_pitta",
        type: "pitta",
        text: "Розум гострий, критики та інтенсивності забагато. Коли приходить втома, він спалахує різкістю чи нетерплячістю.",
      },
      {
        code: "b04_kapha",
        type: "kapha",
        text: "Розум ніби огорнутий ранковим туманом: думки повільні, зосередитися важко, тягне в сон.",
      },
    ],
  },
  {
    code: "b05",
    topic: "Суглоби, м'язи і рух",
    text: "Як почуваються суглоби і м'язи, коли ви рухаєтеся?",
    options: [
      {
        code: "b05_balance",
        type: "balance",
        text: "Тіло рухливе і гнучке, суглоби рухаються плавно і безшумно, ніби змащені зсередини.",
      },
      {
        code: "b05_vata",
        type: "vata",
        text: "Суглоби іноді потріскують, у тілі сухість, а м'язи швидко втомлюються від напруги.",
      },
      {
        code: "b05_pitta",
        type: "pitta",
        text: "У м'язах і суглобах — внутрішнє тепло, чутливість або гарячий натяг після навантаження.",
      },
      {
        code: "b05_kapha",
        type: "kapha",
        text: "Зранку суглоби «іржаві» й скуті, потрібен час на розігрів, у тілі тупий застій.",
      },
    ],
  },
  {
    code: "b06",
    topic: "Стрес і зміни",
    text: "Як ви реагуєте на несподіванки, зміни планів чи навантаження?",
    options: [
      {
        code: "b06_balance",
        type: "balance",
        text: "Зустрічаю зміни гнучко і спокійно, внутрішній стрижень лишається на місці.",
      },
      {
        code: "b06_vata",
        type: "vata",
        text: "Зміни швидко вибивають із колії: суєта, розгубленість, хвилювання в грудях чи животі.",
      },
      {
        code: "b06_pitta",
        type: "pitta",
        text: "У стресі з'являються різкість і контроль, внутрішній гнів, бажання все виправити й перемогти.",
      },
      {
        code: "b06_kapha",
        type: "kapha",
        text: "У стресі закриваюся, хочеться сховатися від світу, сповільнююся до заціпеніння й відкладаю рішення на потім.",
      },
    ],
  },
  {
    code: "b07",
    topic: "Шкіра, тепло і холод",
    text: "Які у вас стосунки з температурою довкола?",
    options: [
      {
        code: "b07_balance",
        type: "balance",
        text: "Шкіра здорова й адаптивна, тіло добре почувається в різну погоду.",
      },
      {
        code: "b07_vata",
        type: "vata",
        text: "Часто мерзну, кінцівки холодні, шкіра суха, лущиться і чутлива до вітру.",
      },
      {
        code: "b07_pitta",
        type: "pitta",
        text: "Постійно жарко, спеку переношу погано, на шкірі легко з'являються почервоніння чи висипання, багато поту.",
      },
      {
        code: "b07_kapha",
        type: "kapha",
        text: "Холод переношу легко, але не люблю вологу і сирість; шкіра щільна, прохолодна на дотик.",
      },
    ],
  },
  {
    code: "b08",
    topic: "Сон і відновлення",
    text: "Яким є ваш сон і стан після нього?",
    options: [
      {
        code: "b08_balance",
        type: "balance",
        text: "Сон глибокий і рівний. Прокидаюся з відчуттям відновлення і спокою.",
      },
      {
        code: "b08_vata",
        type: "vata",
        text: "Сон чуйний, поверхневий. Довго засинаю через думки або прокидаюся серед ночі.",
      },
      {
        code: "b08_pitta",
        type: "pitta",
        text: "Сон середньої тривалості, але можу прокинутися від внутрішнього жару або тривожних робочих сюжетів.",
      },
      {
        code: "b08_kapha",
        type: "kapha",
        text: "Сон довгий і глибокий, але важкий: навіть після багатьох годин вранці немає бадьорості, ніби відпочинку й не було.",
      },
    ],
  },
  {
    code: "b09",
    topic: "Емоційний осад",
    text: "Як вам наодинці з минулим досвідом?",
    options: [
      {
        code: "b09_balance",
        type: "balance",
        text: "Легко відпускаю те, що минуло, лишаючи в собі вдячність і простір.",
      },
      {
        code: "b09_vata",
        type: "vata",
        text: "Довго прокручую в голові минулі розмови, хвилююся про майбутнє, збираю ментальний пил.",
      },
      {
        code: "b09_pitta",
        type: "pitta",
        text: "Ношу в собі гострі спогади про несправедливість, вогонь образ чи бажання довести свою правоту.",
      },
      {
        code: "b09_kapha",
        type: "kapha",
        text: "Образи і втома осідають усередині важким камінням. Важко прощатися зі старими речами, людьми, звичками.",
      },
    ],
  },
];

export type BalanceScores = Record<BalanceType, number>;

export type BalanceReading = {
  /** The reading the result screen leads with. */
  primary: BalanceType;
  /**
   * A second dosha loud enough to name beside the primary one, or null.
   *
   * The author's draft printed the single largest count and nothing else, so
   * 4 vata / 4 kapha / 1 balance told the reader only about vata. The second
   * signal is what keeps that reader's heavy mornings from vanishing.
   */
  secondary: BalanceDosha | null;
  scores: BalanceScores;
};

/**
 * How many answers a dosha needs before the result names it as a second
 * signal: a third of the test. Below that it is one or two stray answers, and
 * naming it would turn every result into a list.
 */
export const BALANCE_SECONDARY_MIN = 3;

/* WHO WINS A TIE. The draft kept whichever key came first in the object —
   `balance` — so a reader split evenly between rest and trouble was told
   everything was fine. Here an imbalance beats balance on a tie: it is the
   reading the reader can act on, and the one they came to find. Between two
   doshas, vata goes first, then pitta, then kapha — the classical order, in
   which vata is the one that moves the other two. */
const TIE_ORDER: readonly BalanceType[] = ["vata", "pitta", "kapha", "balance"];

export function emptyBalanceScores(): BalanceScores {
  return { balance: 0, vata: 0, pitta: 0, kapha: 0 };
}

export function scoreBalanceAnswers(types: readonly BalanceType[]): BalanceScores {
  const scores = emptyBalanceScores();
  for (const type of types) scores[type] += 1;
  return scores;
}

export function readBalance(scores: BalanceScores): BalanceReading {
  const ranked = [...TIE_ORDER].sort((a, b) => scores[b] - scores[a] || TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b));
  const primary = ranked[0] ?? "balance";
  const secondary =
    ranked.find(
      (type): type is BalanceDosha => type !== "balance" && type !== primary && scores[type] >= BALANCE_SECONDARY_MIN,
    ) ?? null;
  return { primary, secondary, scores };
}

/* ─── Result copy ─────────────────────────────────────────────────────────── */

export type BalancePractice = { label: string; text: string };

export type BalanceResultCopy = {
  /** The element's name for the state — the heading. */
  title: string;
  /** The author's image for it — the line under the heading. */
  image: string;
  quote: string;
  summary: string;
  practices: readonly BalancePractice[];
  /** A caution that belongs to one of the practices, printed under them. */
  caution?: string;
};

export const BALANCE_RESULT_COPY: Record<BalanceType, BalanceResultCopy> = {
  balance: {
    title: "Баланс стихій",
    image: "Три доші в гармонії",
    quote:
      "Коли внутрішні стихії в тиші танцюють свій танок, дерево міцно тримається за землю, а річка тече своїм часом.",
    summary:
      "Ваша енергія зараз у гармонійному стані. Вогонь травлення рівний, розум зберігає ясність. Завдання — не ламати те, що працює, а дбайливо підтримувати цей стан.",
    practices: [
      {
        label: "Спосіб життя",
        text: "Тримайте стабільний режим дня: лягайте до 22:00 і прокидайтеся разом із сонцем. Більше часу на свіжому повітрі.",
      },
      {
        label: "Харчування",
        text: "Свіжа, тепла, приготована з любов'ю їжа. Уникайте переїдання і холодної їжі ввечері, насолоджуйтеся смаками в міру.",
      },
      {
        label: "Дихання і практики",
        text: "Рівне дихання з однаковою тривалістю вдиху і видиху — по 4–5 секунд, — щоб утримувати центр у рівновазі.",
      },
      {
        label: "Природні засоби",
        text: "Тепла вода зранку, легкий трав'яний чай із м'ятою або фенхелем.",
      },
    ],
  },
  vata: {
    title: "Дисбаланс вати",
    image: "Вітер у розумі та тілі",
    quote: "Ваш розум зараз як осінній вітер — швидкий, легкий, але йому бракує опори й заземлення.",
    summary:
      "Коли вата виходить з берегів, з'являються тривожність, сухість у тілі, хаос у думках і поверхневий сон. Тілу й розуму потрібні тепло, мастило, режим і спокій.",
    practices: [
      {
        label: "Спосіб життя",
        text: "Уникайте поспіху, хаосу та інформаційного шуму. Ваші союзники — тепло, затишок, м'яке світло і тиша. Перед душем — самомасаж теплою кунжутною олією (абх'янга).",
      },
      {
        label: "Харчування",
        text: "Тепла, масляниста, зварена їжа з насиченими смаками: супи, каші (особливо рисова і вівсяна), тушковані овочі. Уникайте сухої, холодної, сирої їжі та надлишку кави.",
      },
      {
        label: "Дихання і практики",
        text: "Повільне глибоке дихання животом. Наді шодхана — дихання почергово через ніздрі — добре заспокоює вітер у голові.",
      },
      {
        label: "Природні засоби",
        text: "На ніч — тепле молоко з кардамоном і дрібкою мускатного горіха; трав'яні чаї з ашвагандхою, імбиром і корицею.",
      },
    ],
  },
  pitta: {
    title: "Дисбаланс пітти",
    image: "Вогонь, що випалює простір",
    quote: "Внутрішнє сонце зараз світить занадто яскраво — і стає спекою, яка випалює спокій і приносить гостроту.",
    summary:
      "Коли пітти забагато, з'являються нетерплячість, критичність, печія, запальність і перегрів — у тілі й у думках. Тілу потрібні прохолода, розслаблення і солодкуватий спокій.",
    practices: [
      {
        label: "Спосіб життя",
        text: "Менше конкуренції, гарячих суперечок і роботи на межі вигорання. Більше часу біля води і на природі в затінку; дозвольте собі бодай кілька годин на тиждень нічого не досягати.",
      },
      {
        label: "Харчування",
        text: "Пітту охолоджують солодкий, гіркий і в'яжучий смаки: свіжі салати, солодкі фрукти, рис, кіноа, зелень. Уникайте надто гострого, солоного, кислого, алкоголю і надлишку спецій.",
      },
      {
        label: "Дихання і практики",
        text: "Охолоджувальне дихання шіталі — вдих крізь згорнутий трубочкою язик — або спокійний подовжений видих. Медитації на прохолоду і місячне світло.",
      },
      {
        label: "Природні засоби",
        text: "Прохолодна вода з пелюстками троянди або м'ятою; чай із фенхелем, коріандром і солодкою.",
      },
    ],
  },
  kapha: {
    title: "Дисбаланс капхи та ама",
    image: "Туман і важкість на шляху",
    quote:
      "Як ранковий туман над водою, липка енергія і застій огорнули ваші канали й приглушили внутрішній вогонь травлення.",
    summary:
      "Коли накопичуються капха і токсини (ама), з'являються важкість, ранкова скутість, туман у голові й небажання рухатися. Тілу потрібні рух, легкість, спеції і розпалювання агні.",
    practices: [
      {
        label: "Спосіб життя",
        text: "Більше динаміки: ранкова зарядка, активні прогулянки на свіжому повітрі. Уникайте денного сну і важких лінивих вечорів.",
      },
      {
        label: "Харчування",
        text: "Легка, суха, тепла їжа з прянощами: тушковані овочі, бобові, гіркі зелені салати. Менше важких жирів, цукру, молочного і холодних напоїв — вони гасять вогонь.",
      },
      {
        label: "Дихання і практики",
        text: "Капалабхаті — «череп, що світиться»: швидкі активні видихи животом, які розганяють застій і зігрівають зсередини.",
      },
      {
        label: "Природні засоби",
        text: "Натще — тепла вода з імбиром, лимоном і краплею меду; спеції — куркума, чорний перець, імбир, кумін, асафетида.",
      },
    ],
    /* Kapalabhati is a forceful abdominal practice. The line is the platform's,
       not the author's: a result screen hands a technique to someone nobody
       has examined, so the contraindications travel with it. */
    caution:
      "Капалабхаті не практикують під час вагітності, при підвищеному тиску, хворобах серця і після операцій на животі — у таких випадках спершу порадьтеся з фахівцем.",
  },
};

export const BALANCE_TYPE_LABEL: Record<BalanceType, string> = {
  balance: "Баланс",
  vata: "Вата",
  pitta: "Пітта",
  kapha: "Капха",
};

export const BALANCE_HOW_IT_WORKS = [
  "Дев'ять питань про ранок, травлення, розум, тіло, сон і емоційний фон.",
  "У кожному — один варіант, найближчий до того, як є зараз, а не як було колись.",
  "Стан видно одразу; що з ним робити і збереження — після входу через Google або код на пошту.",
];

export const BALANCE_VS_DOSHA =
  "Тест доші читає конституцію — природу, з якою ви народилися і яка змінюється повільно. Цей тест читає поточний стан: яка з трьох сил зараз вийшла з берегів, а яка тримає рівновагу. Тому відповідати варто про останні тижні, а не про те, якими ви є взагалі.";

export const BALANCE_BOUNDARY_NOTE =
  "Це оздоровчий орієнтир, а не медичний діагноз. Він допомагає побачити, що зараз відбувається з вашою енергією, але не замінює лікаря: якщо маєте стійкі або гострі симптоми, спочатку проконсультуйтеся з фахівцем.";

/* ─── Presentation ────────────────────────────────────────────────────────── */

function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The options of one question in the order this reader sees them.
 *
 * The draft printed them А-Б-В-Г in seed order, so balance was always the
 * first answer under the thumb and kapha always the last — a primacy effect
 * built into the instrument, and a key anyone could read after two questions.
 * The order is seeded by the attempt so that walking back finds every answer
 * where it was.
 */
export function orderOptionsForAttempt(question: BalanceQuestion, seed: string): BalanceOption[] {
  const out = [...question.options];
  let state = hash32(`${seed}:${question.code}`) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const atI = out[i] as BalanceOption;
    out[i] = out[j] as BalanceOption;
    out[j] = atI;
  }
  return out;
}
