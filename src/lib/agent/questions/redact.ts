/**
 * Stripping the person out of a question before the question is stored.
 *
 * WHY REDACTION HAPPENS AT WRITE TIME. A support message is somebody describing
 * their situation, and situations come with email addresses, phone numbers and
 * order references attached — the bot literally asks for a contact one step
 * earlier. Storing the raw text and cleaning it later is the version that
 * fails: the raw row exists in a backup, in a log, in whatever query somebody
 * ran in between. What is never written cannot leak.
 *
 * WHAT THIS CORPUS IS, AND IS NOT. It is a record of what people ASK, kept to
 * find out whether the assistant can answer it. It is not a support log: no
 * telegram id, no username, no account id, no thread reference is stored beside
 * the text, deliberately, so a row cannot be walked back to a person. The
 * identifiable conversation continues to live in Telegram, where a human
 * answers it — which is where it belongs.
 *
 * THE REDACTION IS DELIBERATELY BLUNT. It replaces rather than deletes, so the
 * shape of the sentence survives: «оплатив з карти 4149…, пошта ivan@…» becomes
 * «оплатив з карти [номер], пошта [пошта]». A question with its structure
 * intact is still a usable test case; a question with holes in it is noise.
 */

export type Redaction = {
  text: string;
  /** What kinds were removed, for the row's own record. Never the values. */
  removed: string[];
};

/**
 * Order matters and is not alphabetical: emails go first, because an address
 * contains a dot-separated run the URL rule would otherwise claim half of, and
 * a local part the handle rule would eat.
 *
 * ONE RULE FOR EVERY LONG NUMBER, and it is labelled «номер» rather than
 * «телефон». The first version had two — a phone shape and a generic digit run
 * — and they could not be told apart: «1029384756» is a ten-digit order
 * reference and «0636024450» is a ten-digit mobile, and no regular expression
 * knows which is which. Two rules meant one of them was always mislabelled,
 * which is a worse outcome than a single honest label: both are a number that
 * identifies a person, and both leave.
 *
 * The threshold is five digits, so «Шлях 21», «4100 грн» and «день 3» survive.
 * A price and a product name are the vocabulary of the questions this corpus
 * exists to collect.
 */
const RULES: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: "email", pattern: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu, replacement: "[пошта]" },
  { name: "url", pattern: /https?:\/\/\S+/g, replacement: "[посилання]" },
  { name: "handle", pattern: /(^|\s)@[\p{L}\p{N}_]{3,}/gu, replacement: "$1[нік]" },
  {
    name: "number",
    // Either a phone shape — ten digits or more, with up to two separators
    // between them, which is what «+38 (063) 602 44 50» actually needs — or any
    // bare run of five digits and up.
    pattern: /(?:\+?\d[\s().-]{0,2}){9,15}\d|\b\d{5,}\b/g,
    replacement: "[номер]",
  },
];

export function redactPersonal(input: string): Redaction {
  const removed: string[] = [];
  let text = input;

  for (const rule of RULES) {
    if (!rule.pattern.test(text)) continue;
    // `test` on a /g regex advances lastIndex; reset before replacing or the
    // first match after the cursor is the only one replaced.
    rule.pattern.lastIndex = 0;
    text = text.replace(rule.pattern, rule.replacement);
    removed.push(rule.name);
  }

  return { text: text.replace(/\s+/g, " ").trim(), removed };
}

/**
 * The shortest text worth keeping, in characters.
 *
 * Below this a message is «дякую», «ок», or a bare contact the person pasted
 * before reading the prompt. None of those is a question, and a corpus padded
 * with them makes every later count — how many people ask about access, how
 * often retrieval misses — quietly wrong.
 */
export const MIN_QUESTION_CHARS = 12;

/**
 * Is what is left, after redaction, still a question worth storing?
 *
 * The second condition is the one that matters: a message that was ONLY a
 * contact detail redacts down to «[пошта]» and would otherwise be stored as a
 * question with no content, permanently, having taught us nothing.
 */
export function isStorableQuestion(redacted: string): boolean {
  if (redacted.length < MIN_QUESTION_CHARS) return false;
  const withoutPlaceholders = redacted.replace(/\[(пошта|посилання|нік|номер)\]/g, "").trim();
  return withoutPlaceholders.length >= MIN_QUESTION_CHARS;
}
