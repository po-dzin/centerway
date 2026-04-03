import { readFile } from "node:fs/promises";

const ADMIN_KEY_PREFIXES = [
  "sidebar_",
  "nav_",
  "login_",
  "admin_",
  "menu_",
  "loading",
  "common_",
  "audit_",
  "analytics_",
  "system_",
  "orders_",
  "jobs_",
  "customers_",
];

const FORBIDDEN_RU = [
  /последн(ий|яя)\s+шанс/i,
  /только\s+сегодня/i,
  /срочно/i,
  /купи\s+сейчас/i,
  /не\s+упусти/i,
];

const FORBIDDEN_EN = [
  /last\s+chance/i,
  /today\s+only/i,
  /act\s+now/i,
  /buy\s+now/i,
  /don't\s+miss/i,
  /limited\s+time/i,
];

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function shouldCheckKey(key) {
  return ADMIN_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function parseTranslations(fileContent) {
  const startMarker = "export const translations =";
  const endMarker = "} as const;";
  const start = fileContent.indexOf(startMarker);
  const end = fileContent.lastIndexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error("Unable to find translations object in src/lib/i18n.ts");
  }
  const objectSource = fileContent
    .slice(start + startMarker.length, end + 1)
    .trim();
  return Function(`"use strict"; return (${objectSource});`)();
}

function checkKeyParity(translations) {
  const ru = translations.ru ?? {};
  const en = translations.en ?? {};
  const ruKeys = Object.keys(ru).filter(shouldCheckKey);
  const enKeys = Object.keys(en).filter(shouldCheckKey);

  const ruMissing = ruKeys.filter((key) => !(key in en));
  const enMissing = enKeys.filter((key) => !(key in ru));

  if (ruMissing.length === 0 && enMissing.length === 0) {
    pass("admin i18n key parity RU/EN is consistent");
    return;
  }
  if (ruMissing.length > 0) fail(`admin keys missing in EN: ${ruMissing.join(", ")}`);
  if (enMissing.length > 0) fail(`admin keys missing in RU: ${enMissing.join(", ")}`);
}

function checkTone(translations) {
  const ru = translations.ru ?? {};
  const en = translations.en ?? {};

  for (const [key, value] of Object.entries(ru)) {
    if (!shouldCheckKey(key) || typeof value !== "string") continue;
    for (const pattern of FORBIDDEN_RU) {
      if (pattern.test(value)) {
        fail(`forbidden RU pressure phrase found in key "${key}": "${value}"`);
      }
    }
  }

  for (const [key, value] of Object.entries(en)) {
    if (!shouldCheckKey(key) || typeof value !== "string") continue;
    for (const pattern of FORBIDDEN_EN) {
      if (pattern.test(value)) {
        fail(`forbidden EN pressure phrase found in key "${key}": "${value}"`);
      }
    }
  }

  if (!process.exitCode) pass("admin i18n tone guard passed");
}

async function main() {
  console.log("Admin i18n/tone smoke started");
  const source = await readFile("src/lib/i18n.ts", "utf8");
  const translations = parseTranslations(source);
  checkKeyParity(translations);
  checkTone(translations);
  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin i18n/tone smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
