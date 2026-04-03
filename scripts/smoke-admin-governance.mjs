import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const SEARCH_SCOPE = ["src/app/admin", "src/components"];
const FORBIDDEN_CLASS_PATTERN =
  "(text|bg|border|from|to|ring|divide|hover:bg|hover:text)-(blue|indigo|emerald|purple|green|yellow|red|gray)-|bg-gradient|text-transparent";

const HEX_SCOPE = ["src/app/admin", "src/components/admin"];
const HEX_ALLOWLIST = [
  "src/app/admin/page.tsx", // Google brand icon in auth button
];

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function runRg(args) {
  try {
    const { stdout } = await execFileAsync("rg", args, { encoding: "utf8" });
    return stdout.trim();
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : null;
    if (code === 1) return "";
    throw error;
  }
}

async function checkForbiddenTailwindClasses() {
  const matches = await runRg(["-n", FORBIDDEN_CLASS_PATTERN, ...SEARCH_SCOPE]);
  if (!matches) {
    pass("no forbidden Tailwind color/gradient classes in admin scope");
    return;
  }
  fail("forbidden Tailwind color/gradient classes detected:");
  console.log(matches);
}

async function checkHexHardcodes() {
  const matches = await runRg(["-n", "#[0-9A-Fa-f]{3,8}", ...HEX_SCOPE]);
  if (!matches) {
    pass("no hex hardcodes in admin/component scope");
    return;
  }
  const filtered = matches
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .filter((line) => !HEX_ALLOWLIST.some((allowed) => line.startsWith(`${allowed}:`)));

  if (filtered.length === 0) {
    pass("hex hardcodes only found in allowlist");
    return;
  }

  fail("unexpected hex hardcodes detected:");
  console.log(filtered.join("\n"));
}

async function checkGlobalMotionAndFocusRules() {
  const globals = await readFile("src/app/globals.css", "utf8");

  const requiredSnippets = [
    "prefers-reduced-motion: reduce",
    ".cw-btn:focus-visible",
    ".cw-icon-btn:focus-visible",
    ".cw-input:focus-visible",
    ".cw-page-btn:focus-visible",
  ];

  const missing = requiredSnippets.filter((snippet) => !globals.includes(snippet));
  if (missing.length === 0) {
    pass("globals.css contains reduced-motion and focus-visible contract");
    return;
  }
  fail(`globals.css is missing required contract snippets: ${missing.join(", ")}`);
}

async function main() {
  console.log("Admin governance smoke started");
  await checkForbiddenTailwindClasses();
  await checkHexHardcodes();
  await checkGlobalMotionAndFocusRules();

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin governance smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
