import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const sharedTokensPath = path.join(rootDir, "public/shared/css/tokens.css");
const appGlobalsPath = path.join(rootDir, "src/app/globals.css");
const shortProductPath = path.join(rootDir, "public/short/css/short.product.css");
const shortProductResponsivePath = path.join(rootDir, "public/short/css/short.product.responsive.css");
const iremProductPath = path.join(rootDir, "public/irem/css/irem.product.css");
const iremProductResponsivePath = path.join(rootDir, "public/irem/css/irem.product.responsive.css");
const shortIndexPath = path.join(rootDir, "public/short/index.html");
const iremIndexPath = path.join(rootDir, "public/irem/index.html");
const shortIndex2Path = path.join(rootDir, "public/short/index2.html");
const iremIndex2Path = path.join(rootDir, "public/irem/index2.html");
const shortPublicOfferPath = path.join(rootDir, "public/short/public-offer.html");
const iremPublicOfferPath = path.join(rootDir, "public/irem/public-offer.html");
const removedLegacyCssFiles = [
  path.join(rootDir, "public/short/css/main.css"),
  path.join(rootDir, "public/short/css/media.css"),
  path.join(rootDir, "public/short/css/main2.css"),
  path.join(rootDir, "public/irem/css/main.css"),
  path.join(rootDir, "public/irem/css/media.css"),
  path.join(rootDir, "public/irem/css/main2.css"),
];

const requiredDsTokens = [
  "--ds-color-bg-canvas",
  "--ds-color-bg-soft",
  "--ds-color-surface",
  "--ds-color-text",
  "--ds-color-text-muted",
  "--ds-color-primary",
  "--ds-color-primary-strong",
  "--ds-color-accent",
  "--ds-color-accent-strong",
  "--ds-color-border-soft",
  "--ds-font-family-base",
  "--ds-font-size-100",
  "--ds-font-size-200",
  "--ds-font-size-300",
  "--ds-font-size-400",
  "--ds-font-size-500",
  "--ds-font-size-600",
  "--ds-line-height-tight",
  "--ds-line-height-body",
  "--ds-space-1",
  "--ds-space-2",
  "--ds-space-3",
  "--ds-space-4",
  "--ds-space-5",
  "--ds-space-6",
  "--ds-space-7",
  "--ds-radius-sm",
  "--ds-radius-md",
  "--ds-radius-lg",
  "--ds-radius-pill",
  "--ds-shadow-sm",
  "--ds-shadow-md",
  "--ds-z-base",
  "--ds-z-sticky",
  "--ds-breakpoint-mobile-max",
  "--ds-breakpoint-tablet-min",
  "--ds-breakpoint-tablet-max",
  "--ds-breakpoint-desktop-min",
  "--ds-container-max",
  "--ds-touch-target-min",
];

const requiredProductTokens = [
  "--ds-color-product-bg-warm",
  "--ds-color-product-bg-surface-subtle",
  "--ds-color-product-bg-surface-warm",
  "--ds-color-product-text-strong",
  "--ds-color-product-bg-soft-peach",
  "--ds-color-product-bg-card",
  "--ds-color-product-bg-badge",
  "--ds-color-product-text-badge",
  "--ds-color-product-accent-soft",
  "--ds-color-product-success-bg",
  "--ds-color-product-success-text",
  "--ds-color-product-price-accent",
];

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function findMissingTokens(source, required) {
  return required.filter((token) => !source.includes(`${token}:`));
}

function logMissing(filePath, missing) {
  if (missing.length === 0) return;
  console.error(`\n[FAIL] Missing tokens in ${filePath}`);
  for (const token of missing) {
    console.error(`  - ${token}`);
  }
}

function assertNoRawHex(filePath) {
  const content = readFile(filePath);
  const markers = ["/* Product overrides */", "/* Product responsive overrides */"];
  let inspectedContent = content;

  for (const marker of markers) {
    const markerIndex = content.indexOf(marker);
    if (markerIndex >= 0) {
      inspectedContent = content.slice(markerIndex + marker.length);
      break;
    }
  }
  const matches = [...inspectedContent.matchAll(/#([0-9a-fA-F]{3,8})/g)];
  if (matches.length === 0) {
    console.log(`[PASS] No raw hex in ${path.relative(rootDir, filePath)}`);
    return true;
  }

  const unique = [...new Set(matches.map((entry) => entry[0]))];
  console.error(`\n[FAIL] Raw hex found in ${path.relative(rootDir, filePath)}`);
  for (const hex of unique) {
    console.error(`  - ${hex}`);
  }
  return false;
}

function main() {
  let failed = false;

  const sharedTokens = readFile(sharedTokensPath);
  const appGlobals = readFile(appGlobalsPath);

  const missingInShared = [
    ...findMissingTokens(sharedTokens, requiredDsTokens),
    ...findMissingTokens(sharedTokens, requiredProductTokens),
  ];
  const missingInApp = findMissingTokens(appGlobals, requiredDsTokens);

  logMissing(path.relative(rootDir, sharedTokensPath), missingInShared);
  logMissing(path.relative(rootDir, appGlobalsPath), missingInApp);

  if (missingInShared.length === 0) {
    console.log(`[PASS] Shared tokens contract in ${path.relative(rootDir, sharedTokensPath)}`);
  } else {
    failed = true;
  }

  if (missingInApp.length === 0) {
    console.log(`[PASS] App DS bridge contract in ${path.relative(rootDir, appGlobalsPath)}`);
  } else {
    failed = true;
  }

  const colorChecks = [
    assertNoRawHex(shortProductPath),
    assertNoRawHex(shortProductResponsivePath),
    assertNoRawHex(iremProductPath),
    assertNoRawHex(iremProductResponsivePath),
  ];

  if (colorChecks.some((ok) => !ok)) {
    failed = true;
  }

  const htmlPaths = [
    shortIndexPath,
    iremIndexPath,
    shortIndex2Path,
    iremIndex2Path,
    shortPublicOfferPath,
    iremPublicOfferPath,
  ];
  const legacyCssPattern = /css\/(main|media|main2)\.css/;
  for (const htmlPath of htmlPaths) {
    const html = readFile(htmlPath);
    if (legacyCssPattern.test(html)) {
      failed = true;
      console.error(`\n[FAIL] Legacy CSS include found in ${path.relative(rootDir, htmlPath)}`);
    } else {
      console.log(`[PASS] No legacy CSS include in ${path.relative(rootDir, htmlPath)}`);
    }
  }

  for (const legacyPath of removedLegacyCssFiles) {
    if (fs.existsSync(legacyPath)) {
      failed = true;
      console.error(`\n[FAIL] Legacy CSS file still exists: ${path.relative(rootDir, legacyPath)}`);
    } else {
      console.log(`[PASS] Legacy CSS file removed: ${path.relative(rootDir, legacyPath)}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log("\n[PASS] DS contract guard passed");
}

main();
