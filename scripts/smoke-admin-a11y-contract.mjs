import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
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
    throw error;
  }
}

async function checkNoClickableDivs() {
  const hits = await runRg([
    "-n",
    "<div[^>]*onClick=",
    "--glob",
    "!src/components/admin/modals/*",
    "src/app/admin",
    "src/components/admin",
  ]);
  if (!hits) {
    pass("no clickable div patterns in admin scope");
    return;
  }
  fail("clickable div pattern found in admin scope:");
  console.log(hits);
}

async function checkDialogSemantics() {
  const modalFiles = [
    "src/components/admin/modals/ReconcileModal.tsx",
    "src/components/admin/modals/JobDetailsModal.tsx",
  ];

  let ok = true;
  for (const file of modalFiles) {
    const content = await readFile(file, "utf8");
    const hasDialogRole = content.includes('role="dialog"');
    const hasAriaModal = content.includes('aria-modal="true"');
    if (!hasDialogRole || !hasAriaModal) {
      ok = false;
      fail(`${file}: missing role=\"dialog\" and/or aria-modal=\"true\"`);
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
  console.log("Admin a11y contract smoke started");
  await checkNoClickableDivs();
  await checkDialogSemantics();
  await checkReducedMotionRule();
  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin a11y contract smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
