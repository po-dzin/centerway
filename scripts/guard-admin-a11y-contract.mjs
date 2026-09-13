import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
      // Fallback for runners without ripgrep.
      // Supported shape in this script:
      // ["-n", pattern, "--glob", "!<exclude>", ...paths]
      const pattern = args[1];
      const hasGlob = args[2] === "--glob" && typeof args[3] === "string";
      const excludedPrefix = hasGlob ? args[3].replace(/^!/, "").replace(/\*.*$/, "") : null;
      const paths = hasGlob ? args.slice(4) : args.slice(2);

      try {
        const { stdout } = await execFileAsync("grep", ["-RInE", pattern, ...paths], { encoding: "utf8" });
        const raw = stdout.trim();
        if (!raw) return "";
        if (!excludedPrefix) return raw;

        return raw
          .split("\n")
          .filter((line) => !line.startsWith(`${excludedPrefix}:`))
          .join("\n")
          .trim();
      } catch (grepError) {
        const grepCode = grepError && typeof grepError === "object" ? grepError.code : null;
        if (grepCode === 1) return "";
        throw grepError;
      }
    }
    throw error;
  }
}

async function checkNoClickableDivs() {
  const hits = await runRg([
    "-n",
    "<div[^>]*onClick=",
    "--glob",
    "!src/components/admin/modals/*",
    "src/app/(platform)/admin",
    "src/components/admin",
  ]);
  if (!hits) {
    pass("no clickable div patterns in admin scope");
    return;
  }
  fail("clickable div pattern found in admin scope:");
  console.log(hits);
}

/* A DIALOG EITHER CARRIES THE SEMANTICS OR DELEGATES TO THE ONE THAT DOES.
 *
 * This used to demand `role="dialog"` and `aria-modal="true"` in each named
 * modal file, which was right while each of them built its own overlay and
 * wrong the moment they stopped. On 2026-09-12 both moved onto `AdminModal` —
 * which is where the focus trap, the Escape listener on `document`, the scroll
 * lock and the return of focus to the opener live — and this guard failed them
 * for it, i.e. it asked for the markup to be copied back out. A guard that
 * punishes the fix is worse than no guard.
 *
 * So: `AdminModal` itself must carry the attributes, and a modal file passes by
 * carrying them OR by mounting `AdminModal`. The list is discovered rather than
 * typed, so a third dialog added tomorrow is checked without editing this. */
const DIALOG_HOST = "src/components/admin/AdminModal.tsx";

async function checkDialogSemantics() {
  const host = await readFile(DIALOG_HOST, "utf8");
  let ok = true;
  if (!host.includes('role="dialog"') || !host.includes('aria-modal="true"')) {
    ok = false;
    fail(`${DIALOG_HOST}: the shared dialog must carry role="dialog" and aria-modal="true"`);
  }

  const modalFiles = (await readdir("src/components/admin/modals"))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `src/components/admin/modals/${name}`);

  for (const file of modalFiles) {
    const content = await readFile(file, "utf8");
    const carriesItself = content.includes('role="dialog"') && content.includes('aria-modal="true"');
    const delegates = content.includes("AdminModal");
    if (!carriesItself && !delegates) {
      ok = false;
      fail(`${file}: neither carries role="dialog" + aria-modal="true" nor mounts AdminModal`);
    }
  }
  if (ok) pass("modal dialog semantics present");
}

async function checkReducedMotionRule() {
  const globals = await readFile("src/app/globals.css", "utf8");
  if (globals.includes("prefers-reduced-motion: reduce")) {
    pass("prefers-reduced-motion rule exists");
    return;
  }
  fail("prefers-reduced-motion rule is missing in globals.css");
}

async function main() {
  console.log("Admin a11y contract guard started");
  await checkNoClickableDivs();
  await checkDialogSemantics();
  await checkReducedMotionRule();
  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin a11y contract guard passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
