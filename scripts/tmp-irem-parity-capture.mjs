import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.CAPTURE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const route = process.env.CAPTURE_PATH || "/irem";
const label = process.env.CAPTURE_LABEL || "local";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(process.cwd(), "artifacts", "irem-parity", `${label}-${stamp}`);

const viewports = [
  { width: 390, height: 844, name: "390" },
  { width: 768, height: 1024, name: "768" },
  { width: 1024, height: 900, name: "1024" },
  { width: 1440, height: 900, name: "1440" },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1800);
      await page.screenshot({
        path: path.join(outDir, `irem-${viewport.name}.png`),
        fullPage: true,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(outDir);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
