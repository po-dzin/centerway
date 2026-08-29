/**
 * The one question the assistant must never answer, recognised without a model.
 *
 * WHY THIS IS NOT LEFT TO RETRIEVAL. The corpus holds a document stating the
 * health boundary, and the first version of this layer relied on search finding
 * it. It did not: a person asks «чи можна мені це при захворюванні», the
 * document says «протипоказання» and «стан здоров'я», and lexical search
 * correctly reported no strong match. That is the ordinary weakness of word
 * matching — and it is tolerable for "how much does it cost" and intolerable
 * here, because the failure is not a worse answer, it is the assistant
 * proceeding to answer a medical question at all.
 *
 * So the boundary is a RULE, checked before retrieval and before the model, and
 * the corpus document is what the person is shown afterwards. A rule over a
 * fixed vocabulary is crude and it over-triggers occasionally; over-triggering
 * here costs one handoff to a person who did not need one, and under-triggering
 * costs advice we are not qualified to give, to somebody with a condition.
 *
 * WHY NOT ASK THE MODEL TO CLASSIFY. Because that is the thing being guarded.
 * A guard that runs inside the model's turn is a guard the prompt can talk its
 * way past, and the whole contour is built on the opposite principle
 * (docs/agent-contour-2026-08-21.md §2, §7).
 */

/**
 * Words that mean somebody is asking about their body's condition rather than
 * about a product.
 *
 * Stems, not words: matching is by prefix, so «вагітн» covers вагітна,
 * вагітність, вагітності. Three languages because the platform's audience
 * writes in all three, and a boundary that holds only in Ukrainian is not a
 * boundary.
 *
 * NOT INCLUDED, deliberately: plain «біль» and «болить». A person saying "у
 * мене болить спина, який курс підійде" is asking a catalogue question, and
 * routing every mention of an ache to a human would make the assistant useless
 * for the thing this platform is actually about.
 */
const CONDITION_STEMS = [
  // uk
  "протипоказ", "захворюв", "хворі", "хвороб", "діагноз", "лікар", "ліку", "ліки", "препарат",
  "вагітн", "годув", "операці", "травм", "тиск", "діабет", "щитовид", "онколог", "пухлин",
  "гіпертон", "гастрит", "виразк", "камін", "нирк", "печінк", "серц", "аритмі", "епілепс",
  // ru
  "противопоказ", "заболев", "болезн", "диагноз", "врач", "лечен", "лекарств",
  "беремен", "кормлен", "операци", "давлен", "диабет", "щитовидк", "онколог", "опухол",
  "гипертон", "язв", "почк", "печен", "сердц", "аритми", "эпилепс",
  // en
  "contraindic", "diagnos", "disease", "illness", "pregnan", "medicat", "prescri", "surger",
];

/** Phrases that ask for permission about one's own body, whatever the condition. */
const PERMISSION_PATTERNS = [
  /чи (можна|безпечно) мен/i,
  /мені можна/i,
  /можно ли мне/i,
  /мне можно/i,
  /is it safe for me/i,
  /can i do this if/i,
];

export type BoundaryVerdict = {
  /** True when this turn belongs to a person, not to the assistant. */
  escalate: boolean;
  /** What matched, for the log — never shown to the person as a reason. */
  matched: string[];
};

function stems(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
}

/**
 * Does this question have to go to a human?
 *
 * A condition word alone is enough. The permission patterns exist for the
 * questions that carry no condition word at all — «чи можна мені це?» — where
 * the thing being asked about is the person, and the assistant has no way to
 * know what it would be agreeing to.
 */
export function needsHumanHandoff(question: string): BoundaryVerdict {
  const words = stems(question);
  const matched = CONDITION_STEMS.filter((stem) => words.some((word) => word.startsWith(stem)));

  for (const pattern of PERMISSION_PATTERNS) {
    if (pattern.test(question)) matched.push(pattern.source);
  }

  return { escalate: matched.length > 0, matched };
}
