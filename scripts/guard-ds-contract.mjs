import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const staticRootDir = path.join(rootDir, "src/landing-static");
const sourceDirsForContractScan = ["src", "scripts"];

const files = {
  sharedTokens: path.join(staticRootDir, "shared/css/tokens.css"),
  landingBridge: path.join(staticRootDir, "shared/css/landing.bridge.css"),
  appGlobals: path.join(rootDir, "src/app/globals.css"),
  landingConfig: path.join(rootDir, "src/lib/landing/config.ts"),
  landingPrepare: path.join(rootDir, "src/lib/landing/prepareLandingHtml.ts"),
  landingContent: path.join(rootDir, "src/lib/landing/content.ts"),
  shortProduct: path.join(staticRootDir, "short/css/short.product.css"),
  shortResponsive: path.join(staticRootDir, "short/css/short.product.responsive.css"),
  iremProduct: path.join(staticRootDir, "irem/css/irem.product.css"),
  iremResponsive: path.join(staticRootDir, "irem/css/irem.product.responsive.css"),
  shortIndex: path.join(staticRootDir, "short/index.html"),
  iremIndex: path.join(staticRootDir, "irem/index.html"),
  shortIndex2: path.join(staticRootDir, "short/index2.html"),
  iremIndex2: path.join(staticRootDir, "irem/index2.html"),
  shortPublicOffer: path.join(staticRootDir, "short/public-offer.html"),
  iremPublicOffer: path.join(staticRootDir, "irem/public-offer.html"),
};

const removedDeprecatedCssFiles = [
  path.join(staticRootDir, "short/css/main.css"),
  path.join(staticRootDir, "short/css/media.css"),
  path.join(staticRootDir, "short/css/main2.css"),
  path.join(staticRootDir, "irem/css/main.css"),
  path.join(staticRootDir, "irem/css/media.css"),
  path.join(staticRootDir, "irem/css/main2.css"),
];

const requiredDsTokens = [
  "--ds-color-bg-canvas",
  "--ds-color-text",
  "--ds-space-4",
  "--ds-radius-lg",
  "--ds-shadow-md",
  "--ds-touch-target-min",
  "--ds-color-product-short-accent",
  "--ds-color-product-price-accent",
];

const requiredLandingTokens = [
  "--landing-color-primary",
  "--landing-color-overlay",
  "--landing-shadow-card-soft",
  "--landing-radius-card",
  "--landing-space-section-padding-y",
  "--landing-type-scale-32",
];

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message, details = []) {
  console.error(`\n[FAIL] ${message}`);
  for (const detail of details) {
    console.error(`  - ${detail}`);
  }
  process.exitCode = 1;
}

function assertTokens(filePath, tokens, label) {
  const content = readFile(filePath);
  const missing = tokens.filter((token) => !content.includes(`${token}:`));
  if (missing.length > 0) {
    fail(label, missing);
    return;
  }
  pass(label);
}

function assertContains(filePath, snippets, label) {
  const content = readFile(filePath);
  const missing = snippets.filter((snippet) => !content.includes(snippet));
  if (missing.length > 0) {
    fail(label, missing);
    return;
  }
  pass(label);
}

function walkFiles(dirPath, acc = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }
    acc.push(fullPath);
  }
  return acc;
}

function assertPathAbsent(filePath, label) {
  if (fs.existsSync(filePath)) {
    fail(label, [path.relative(rootDir, filePath)]);
    return;
  }
  pass(label);
}

function assertNoRepoPattern({
  pattern,
  label,
  include = /\.(?:[cm]?[jt]sx?|mjs|cjs|css|html)$/,
  ignore = [],
}) {
  const offenders = [];
  for (const dir of sourceDirsForContractScan) {
    const root = path.join(rootDir, dir);
    if (!fs.existsSync(root)) continue;
    const filesInDir = walkFiles(root);
    for (const filePath of filesInDir) {
      if (!include.test(filePath)) continue;
      const relPath = path.relative(rootDir, filePath);
      if (ignore.includes(relPath)) continue;
      const lines = readFile(filePath).split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        if (pattern.test(lines[index])) {
          offenders.push(`${relPath}:${index + 1}: ${lines[index].trim()}`);
          if (offenders.length >= 25) break;
        }
        pattern.lastIndex = 0;
      }
      if (offenders.length >= 25) break;
    }
    if (offenders.length >= 25) break;
  }

  if (offenders.length > 0) {
    fail(label, offenders);
    return;
  }
  pass(label);
}

function assertNoPattern(filePath, pattern, label) {
  const content = readFile(filePath);
  const lines = content.split("\n");
  const offenders = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      offenders.push(`line ${index + 1}: ${lines[index].trim()}`);
    }
    pattern.lastIndex = 0;
  }

  if (offenders.length > 0) {
    fail(label, offenders.slice(0, 20));
    return;
  }
  pass(label);
}

function assertNoConsumptionPattern(filePath, pattern, label) {
  const content = readFile(filePath);
  const lines = content.split("\n");
  const offenders = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("--")) {
      continue;
    }
    if (pattern.test(line)) {
      offenders.push(`line ${index + 1}: ${line.trim()}`);
    }
    pattern.lastIndex = 0;
  }

  if (offenders.length > 0) {
    fail(label, offenders.slice(0, 20));
    return;
  }
  pass(label);
}

function assertNoRawHex(filePath, label) {
  const content = readFile(filePath);
  const hexPattern = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/g;
  const allowedRefPattern = /--product-color-ref-[0-9a-f]{6,8}\s*:\s*#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\s*;/;
  const offenders = [];

  for (const match of content.matchAll(hexPattern)) {
    const start = match.index ?? 0;
    const lineStart = content.lastIndexOf("\n", start) + 1;
    const lineEnd = content.indexOf("\n", start);
    const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim();
    if (!allowedRefPattern.test(line)) {
      offenders.push(line);
    }
  }

  if (offenders.length > 0) {
    fail(label, [...new Set(offenders)].slice(0, 20));
    return;
  }
  pass(label);
}

function assertDeprecatedCssRemoval() {
  for (const filePath of removedDeprecatedCssFiles) {
    if (fs.existsSync(filePath)) {
      fail("Deprecated CSS file still exists", [path.relative(rootDir, filePath)]);
    } else {
      pass(`Deprecated CSS removed: ${path.relative(rootDir, filePath)}`);
    }
  }
}

function assertSourceHtmlHealth() {
  const htmlFiles = [
    files.shortIndex,
    files.iremIndex,
    files.shortIndex2,
    files.iremIndex2,
    files.shortPublicOffer,
    files.iremPublicOffer,
  ];

  for (const filePath of htmlFiles) {
    assertNoPattern(filePath, /css\/(main|media|main2)\.css/, `No deprecated CSS include in ${path.relative(rootDir, filePath)}`);
    assertNoPattern(
      filePath,
      /shared\/css\/landing\.css/,
      `No deprecated shared landing include in ${path.relative(rootDir, filePath)}`
    );
  }
}

function assertProductCssGuardrails(filePath, product) {
  const labelPrefix = path.relative(rootDir, filePath);
  assertNoRawHex(filePath, `${labelPrefix}: no raw hex in component rules`);
  assertNoConsumptionPattern(filePath, /var\(--legacy-color-/g, `${labelPrefix}: no legacy-color consumption`);
  assertNoConsumptionPattern(filePath, /var\(--product-color-ref-/g, `${labelPrefix}: no product-color-ref consumption`);
  assertNoConsumptionPattern(filePath, /var\(--product-/g, `${labelPrefix}: no product-* consumption`);
  assertNoConsumptionPattern(filePath, /var\(--ds-color-/g, `${labelPrefix}: no direct ds-color consumption`);
  if (product === "irem") {
    assertNoConsumptionPattern(filePath, /var\(--color-/g, `${labelPrefix}: no irem color-* consumption`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseHeroStringsByProduct(contentFilePath) {
  const source = readFile(contentFilePath);
  const products = ["short", "irem"];
  const byProduct = {};

  for (const product of products) {
    const productBlockRegex = new RegExp(
      `${escapeRegExp(product)}\\s*:\\s*\\{[\\s\\S]*?hero\\s*:\\s*\\{([\\s\\S]*?)\\}\\s*,\\s*utility\\s*:`,
      "m"
    );
    const productMatch = source.match(productBlockRegex);
    if (!productMatch) {
      fail("Hero typed content parity: product block missing", [product]);
      continue;
    }

    const heroBlock = productMatch[1];
    const strings = [];
    const scalarKeys = [
      "badge",
      "title",
      "subtitle",
      "lead",
      "note",
      "ctaPrimaryLabel",
      "ctaStickyLabel",
      "priceCurrent",
      "priceOld",
    ];

    for (const key of scalarKeys) {
      const keyRegex = new RegExp(`${escapeRegExp(key)}\\s*:\\s*"([^"]+)"`, "m");
      const keyMatch = heroBlock.match(keyRegex);
      if (keyMatch) {
        strings.push({ key, value: keyMatch[1] });
      }
    }

    const chipsMatch = heroBlock.match(/chips\s*:\s*\[([\s\S]*?)\]/m);
    if (chipsMatch) {
      const chipStrings = [...chipsMatch[1].matchAll(/"([^"]+)"/g)].map((entry, index) => ({
        key: `chips[${index}]`,
        value: entry[1],
      }));
      strings.push(...chipStrings);
    }

    const priceBlockMatch = heroBlock.match(/price\s*:\s*\{([\s\S]*?)\}/m);
    if (priceBlockMatch) {
      const priceNotesMatch = priceBlockMatch[1].match(/notes\s*:\s*\[([\s\S]*?)\]/m);
      if (priceNotesMatch) {
        const noteStrings = [...priceNotesMatch[1].matchAll(/"([^"]+)"/g)].map((entry, index) => ({
          key: `price.notes[${index}]`,
          value: entry[1],
        }));
        strings.push(...noteStrings);
      }
    }

    if (strings.length === 0) {
      fail("Hero typed content parity: no string fields found in hero block", [product]);
      continue;
    }

    byProduct[product] = strings;
  }

  return byProduct;
}

function assertHeroTypedContentParity() {
  const heroStringsByProduct = parseHeroStringsByProduct(files.landingContent);
  const htmlByProduct = {
    short: readFile(files.shortIndex),
    irem: readFile(files.iremIndex),
  };

  for (const [product, html] of Object.entries(htmlByProduct)) {
    const heroStrings = heroStringsByProduct[product] ?? [];
    if (heroStrings.length === 0) {
      fail("Hero typed content parity: missing parsed hero strings", [product]);
      continue;
    }

    const mismatches = heroStrings
      .filter(({ value }) => !html.includes(value))
      .map(({ key, value }) => `${product}.hero.${key}="${value}"`);

    if (mismatches.length > 0) {
      fail("Hero typed content parity mismatch with static HTML", mismatches);
      continue;
    }

    pass(`Hero typed content parity: ${product}`);
  }
}

function main() {
  assertPathAbsent(path.join(rootDir, "src/app/api/checkout/start/route.ts"), "Removed dead /api/checkout/start route");
  assertNoRepoPattern({
    pattern: /dsGapRegistry/g,
    label: "No dsGapRegistry process artifact usage in runtime/tooling",
    ignore: ["scripts/guard-ds-contract.mjs"],
  });
  assertNoRepoPattern({
    pattern: /\/api\/checkout\/start/g,
    label: "No stale /api/checkout/start references in source/scripts",
    ignore: ["scripts/guard-ds-contract.mjs"],
  });

  assertTokens(files.sharedTokens, requiredDsTokens, "Shared DS token contract");
  assertTokens(files.appGlobals, requiredDsTokens.filter((token) => !token.startsWith("--ds-color-product-")), "App globals DS bridge contract");
  assertTokens(files.landingBridge, requiredLandingTokens, "Landing bridge semantic token contract");

  assertContains(
    files.landingConfig,
    ["/shared/css/landing.bridge.css", "/shared/js/landing-pixel.js", "/shared/js/landing-runtime.js"],
    "Landing shell assets include managed bridge/runtime"
  );
  assertContains(
    files.landingPrepare,
    [
      'data-cw-runtime="next"',
      "/shared/css/landing.bridge.css",
      "/shared/js/landing-pixel.js",
      "/shared/js/landing-runtime.js",
      "stripInlineTracking",
      "SCRIPT_TAG_BLOCK",
    ],
    "Unified landing HTML preparation pipeline sentinels"
  );

  assertDeprecatedCssRemoval();
  assertSourceHtmlHealth();

  assertProductCssGuardrails(files.shortProduct, "short");
  assertProductCssGuardrails(files.shortResponsive, "short");
  assertProductCssGuardrails(files.iremProduct, "irem");
  assertProductCssGuardrails(files.iremResponsive, "irem");
  assertHeroTypedContentParity();

  if (process.exitCode) {
    return;
  }

  console.log("\n[PASS] DS contract guard passed");
}

main();
