import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const HEX_SCOPE = ["src/app/(platform)/admin", "src/components/admin"];
const HEX_ALLOWLIST = [
  // The Google brand mark in the sign-in button: four brand hexes that are not
  // ours to tokenise. It moved out of admin/page.tsx when the admin went to
  // server components (2026-09-10), and this line kept naming the old file —
  // so the guard had been red ever since. An allowlist keyed by path outlives
  // the thing it was granted for; if this happens again, move to the inline
  // `ds-allow-raw-hex` marker that guard-ds-contract.mjs uses instead.
  "src/app/(platform)/admin/AdminGate.tsx",
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
    if (code === "ENOENT") {
      // Fallback for runners where ripgrep is not installed.
      // Supported shape in this script: ["-n", pattern, ...paths]
      const pattern = args[1];
      const paths = args.slice(2);
      try {
        const { stdout } = await execFileAsync("grep", ["-RInE", pattern, ...paths], { encoding: "utf8" });
        return stdout.trim();
      } catch (grepError) {
        const grepCode = grepError && typeof grepError === "object" ? grepError.code : null;
        if (grepCode === 1) return "";
        throw grepError;
      }
    }
    throw error;
  }
}

/*
 * The forbidden Tailwind colour and gradient utilities moved into
 * `eslint.config.mjs` ("THE ADMIN IS GREY") on 2026-09-11: they are string
 * literals in TypeScript, so ESLint matches them exactly and underlines them
 * as they are typed. The two checks below stay because neither is JavaScript —
 * hex literals live mostly in CSS modules, and the last one reads globals.css.
 */

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
  console.log("Admin governance guard started");
  await checkHexHardcodes();
  await checkGlobalMotionAndFocusRules();

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin governance guard passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
