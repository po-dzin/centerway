import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const entry = (process.env.BASELINE_LANDING_ENTRY || "next").toLowerCase();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(process.cwd(), "artifacts", "landing-baseline", `${entry}-${stamp}`);

const paths = {
  next: { short: "/short", irem: "/irem" },
  fallback: { short: "/short", irem: "/irem" },
};

const routes = [
  { name: "short", path: (paths[entry] || paths.next).short },
  { name: "irem", path: (paths[entry] || paths.next).irem },
];

const viewports = [
  { width: 390, height: 844, label: "390" },
  { width: 768, height: 1024, label: "768" },
  { width: 1024, height: 900, label: "1024" },
  { width: 1440, height: 900, label: "1440" },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of routes) {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        const page = await context.newPage();
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });
        await page.screenshot({
          path: path.join(outDir, `${route.name}-${viewport.label}.png`),
          fullPage: true,
        });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`Baseline screenshots saved to ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
