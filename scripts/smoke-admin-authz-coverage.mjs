import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "src", "app", "api", "admin");
const matrixPath = path.join(repoRoot, "data", "admin-authz-matrix.json");
const allowedMethods = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]);

function loadMatrix() {
  const raw = fs.readFileSync(matrixPath, "utf8");
  const matrix = JSON.parse(raw);
  if (!Array.isArray(matrix)) {
    throw new Error(`Invalid authz matrix: expected array in ${path.relative(repoRoot, matrixPath)}`);
  }
  return matrix;
}

const matrix = loadMatrix();

function walkRouteFiles(dir) {
  const entries = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === "route.ts") {
        entries.push(fullPath);
      }
    }
  }

  return entries.sort();
}

function routeFileToPath(filePath) {
  const relative = path.relative(path.join(repoRoot, "src", "app", "api"), filePath).split(path.sep);
  if (relative.at(-1) !== "route.ts") {
    throw new Error(`Unexpected route file path: ${filePath}`);
  }

  const segments = relative.slice(0, -1).map((segment) => {
    if (/^\[\.\.\.(.+)\]$/.test(segment)) {
      return `:${segment.slice(4, -1)}*`;
    }
    const optionalCatchAllMatch = segment.match(/^\[\[\.\.\.(.+)\]\]$/);
    if (optionalCatchAllMatch) {
      return `:${optionalCatchAllMatch[1]}*`;
    }
    const paramMatch = segment.match(/^\[(.+)\]$/);
    if (paramMatch) return `:${paramMatch[1]}`;
    return segment;
  });

  return `/api/${segments.join("/")}`;
}

function extractExportedMethods(fileText) {
  const methods = new Set();
  const exportRegex = /\bexport\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|OPTIONS)\b/g;
  for (const match of fileText.matchAll(exportRegex)) {
    methods.add(match[1]);
  }

  const namedExportRegex = /\bexport\s*\{\s*([^}]+)\s*\}/g;
  for (const match of fileText.matchAll(namedExportRegex)) {
    const names = match[1]
      .split(",")
      .map((value) => value.trim().split(/\s+as\s+/i)[0].trim())
      .filter(Boolean);
    for (const name of names) {
      if (allowedMethods.has(name)) {
        methods.add(name);
      }
    }
  }

  return [...methods].sort();
}

function formatCase(method, routePath) {
  return `${method.padEnd(6, " ")} ${routePath}`;
}

function keyFor(method, routePath) {
  return `${method} ${routePath}`;
}

function getMatrixRoutePath(entry) {
  return typeof entry.routePath === "string" && entry.routePath.trim().length > 0 ? entry.routePath : entry.path;
}

function main() {
  if (!fs.existsSync(apiRoot)) {
    console.error(`ERROR admin api root not found: ${apiRoot}`);
    process.exit(1);
  }

  const routeFiles = walkRouteFiles(apiRoot);
  const actualByKey = new Map();

  for (const filePath of routeFiles) {
    const routePath = routeFileToPath(filePath);
    const fileText = fs.readFileSync(filePath, "utf8");
    const methods = extractExportedMethods(fileText);
    for (const method of methods) {
      actualByKey.set(keyFor(method, routePath), { method, path: routePath, filePath });
    }
  }

  const matrixByKey = new Map(matrix.map((entry) => [keyFor(entry.method, getMatrixRoutePath(entry)), entry]));
  const missing = [];
  const extra = [];

  for (const [key, entry] of actualByKey) {
    if (!matrixByKey.has(key)) {
      missing.push(entry);
    }
  }

  for (const [key, entry] of matrixByKey) {
    if (!actualByKey.has(key)) {
      extra.push({ method: entry.method, path: getMatrixRoutePath(entry) });
    }
  }

  console.log(`Admin authz coverage smoke base path: ${path.relative(repoRoot, apiRoot) || "."}`);
  console.log(`Route files found: ${routeFiles.length}`);
  console.log(`Matrix entries: ${matrix.length}`);

  if (missing.length === 0) {
    console.log("missing in matrix: none");
  } else {
    console.log("missing in matrix:");
    for (const entry of missing) {
      console.log(`  - ${formatCase(entry.method, entry.path)} <- ${path.relative(repoRoot, entry.filePath)}`);
    }
  }

  if (extra.length === 0) {
    console.log("extra in matrix: none");
  } else {
    console.log("extra in matrix:");
    for (const entry of extra) {
      console.log(`  - ${formatCase(entry.method, entry.path)}`);
    }
  }

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

main();
