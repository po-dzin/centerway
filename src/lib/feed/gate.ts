/**
 * The feed's automatic check — the rules half (2026-10-16).
 *
 * G decided there is no manual review: a post or a comment is checked before
 * it appears, and only what the check stops reaches people, as a card in the
 * team's Telegram group. The full check is «model + the CenterWay voice rules».
 * The model half does not exist yet: there is no model call anywhere in this
 * codebase (src/lib/agent/runs.ts), and the agent pieces belong to the thread
 * «Агентный контур платформы». So this file is the rules half, written so that
 * the model half is one more `GateCheck` in the list when it lands, and so that
 * what the team sees in Telegram already reads «which gate, what it found».
 *
 * WHAT THE RULES STOP. Only what a rule can see with certainty and what the
 * brand contract forbids outright:
 *   - a promise to cure, a diagnosis, telling someone to drop their medicine;
 *   - a link out of CenterWay (another shop, another course, a referral code);
 *   - shouting and flooding (capitals, a character repeated, a wall of links).
 * Everything else passes. A rule that stops honest posts teaches authors to
 * ignore the team's group, which is worse than a rare miss the team can hide.
 */

import { FEED_PATH } from "./model";

export type GateRule = "claims" | "links" | "spam";

export type GateFinding = { rule: GateRule; label: string; detail: string };

export type GateVerdict = {
  pass: boolean;
  findings: GateFinding[];
  /** The checks that ran, in order — the card in Telegram lists them. */
  checks: { rule: GateRule; label: string; pass: boolean }[];
};

const LABELS: Record<GateRule, string> = {
  claims: "Без обіцянок вилікувати і діагнозів",
  links: "Без чужої реклами і сторонніх посилань",
  spam: "Без крику і спаму",
};

/* Stems, lower-case, matched on word starts. Ukrainian and Russian, because
   both reach the platform. A stem here must name a PROMISE, not a topic:
   «лікар» or «здоров'я» are words people use honestly every day. */
const CLAIM_PATTERNS: RegExp[] = [
  /(?<!\p{L})(вилікує|вилікуєте|вилікувати|вилікуй|зцілює|зцілить|зцілення від)/iu,
  /(?<!\p{L})(вылечит|вылечите|вылечить|исцелит|исцеляет)/iu,
  /(назавжди|навсегда)[^.!?\n]{0,40}(хвороб|тривог|депрес|діабет|рак|болезн|тревог)/iu,
  /(хвороб|тривог|депрес|діабет|болезн|тревог)[^.!?\n]{0,40}(назавжди|навсегда)/iu,
  /(?<!\p{L})(гарантую|гарантуємо|гарантированно|гарантую результат)/iu,
  /(?<!\p{L})(замість ліків|замість лікування|вместо лекарств|вместо лечения)/iu,
  /(?<!\p{L})(відмовтеся від ліків|киньте ліки|откажитесь от лекарств|бросьте лекарства)/iu,
  /(?<!\p{L})(ставлю діагноз|ваш діагноз|ставлю диагноз|ваш диагноз)/iu,
];

const URL_PATTERN =
  /(?<!\p{L})((?:https?:\/\/|www\.)[^\s<>()]+|[a-z0-9-]+\.(?:com|net|org|ua|ru|shop|store|link|ly|me|io|biz|info|site|online)(?:\/[^\s<>()]*)?)/giu;

/** Where a link may lead without a second look: the platform and its own channels. */
const OWN_HOSTS = [/(^|\.)centerway\.net\.ua$/i, /(^|\.)centerway\.ua$/i];
const OWN_TELEGRAM = [/^t\.me\/(cway_flow|centerway_support_bot)(\/|$)/i];

function hostOf(raw: string): string {
  const clean = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return (clean.split(/[/?#]/)[0] ?? "").toLowerCase();
}

function isOwnLink(raw: string): boolean {
  const clean = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (OWN_TELEGRAM.some((pattern) => pattern.test(clean))) return true;
  const host = hostOf(raw);
  return OWN_HOSTS.some((pattern) => pattern.test(host)) || clean.startsWith(FEED_PATH.slice(1));
}

function checkClaims(text: string): GateFinding | null {
  for (const pattern of CLAIM_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return { rule: "claims", label: LABELS.claims, detail: `«${match[0].trim()}»` };
  }
  return null;
}

function checkLinks(text: string): GateFinding | null {
  const foreign = [...text.matchAll(URL_PATTERN)].map((match) => match[0]).filter((link) => !isOwnLink(link));
  if (foreign.length === 0) return null;
  const hosts = [...new Set(foreign.map(hostOf))].slice(0, 3);
  return { rule: "links", label: LABELS.links, detail: `посилання: ${hosts.join(", ")}` };
}

function checkSpam(text: string): GateFinding | null {
  const letters = text.match(/\p{L}/gu) ?? [];
  const upper = text.match(/\p{Lu}/gu) ?? [];
  if (letters.length >= 40 && upper.length / letters.length > 0.6) {
    return { rule: "spam", label: LABELS.spam, detail: "майже весь текст великими літерами" };
  }
  if (/(.)\1{9,}/u.test(text)) return { rule: "spam", label: LABELS.spam, detail: "символ повторено поспіль" };
  const links = [...text.matchAll(URL_PATTERN)].length;
  if (links > 5) return { rule: "spam", label: LABELS.spam, detail: `${links} посилань` };
  return null;
}

/** Runs every rule; one finding is enough to stop the text. */
export function checkFeedText(text: string): GateVerdict {
  const results: [GateRule, GateFinding | null][] = [
    ["claims", checkClaims(text)],
    ["links", checkLinks(text)],
    ["spam", checkSpam(text)],
  ];
  const findings = results.map(([, finding]) => finding).filter((finding): finding is GateFinding => finding !== null);
  return {
    pass: findings.length === 0,
    findings,
    checks: results.map(([rule, finding]) => ({ rule, label: LABELS[rule], pass: finding === null })),
  };
}
