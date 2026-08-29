#!/usr/bin/env node
/**
 * Generates CenterWay imagery through the Vercel AI Gateway.
 *
 * Provider-agnostic on purpose (research §5d): the gateway is the default
 * adapter because the project already lives on Vercel — the OIDC token from
 * `vercel env pull` is the whole auth story, no new vendor. A second adapter
 * (OpenRouter's unified image API, which takes `input_references` and `seed`
 * in one call) can slot in behind the same interface if reference fidelity
 * ever forces it.
 *
 * TWO GENERATION SHAPES, and the difference matters:
 *   - reference mode (default): a multimodal model receives the existing
 *     approved frames as image parts and is asked for a new frame in the same
 *     series. This is what keeps a set consistent — it is the whole reason the
 *     photography contract can be enforced at all.
 *   - text mode (--no-ref): a pure image model renders from the prompt alone.
 *     Cheaper, but style drifts between frames; use it for exploration only.
 *
 * Output is RAW. Nothing here is shippable until it goes through
 * scripts/img/grade.mjs (grade + sRGB ICC) — pass --grade to chain both.
 *
 * Usage:
 *   node scripts/img/generate.mjs --role backdrop --subject way21 --variant dark \
 *     --ratio 21x9 --ref public/cw/platform/pages/dosha-hero-v1.png --n 2 --grade
 *   node scripts/img/generate.mjs --role object --subject herbs-blend --dry-run
 *   node scripts/img/generate.mjs --list-models
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Auth: the OIDC token lives in .env.vercel.local (pulled separately so the
 * pull never clobbers the hand-maintained .env.local). A static
 * AI_GATEWAY_API_KEY in the environment wins if present.
 */
const ENV_FILES = [".env.vercel.local", ".env.local"];

async function loadEnv() {
  for (const file of ENV_FILES) {
    const raw = await fs.readFile(path.join(ROOT, file), "utf8").catch(() => null);
    if (!raw) continue;
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  }
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error(
      "no gateway credentials — run `vercel env pull .env.vercel.local --yes` (the OIDC token expires after ~24h)",
    );
  }
}

/** Reference model: multimodal, takes image parts. Text model: image-only. */
const MODELS = {
  reference: "google/gemini-3-pro-image",
  text: "bfl/flux-2-pro",
};

/**
 * The photography contract, encoded once (research §1–2). Every prompt is this
 * plus the caller's subject — that is what makes the frames a series rather
 * than a pile.
 */
const CONTRACT = [
  "Natural side light, soft long shadows, a hint of sun through a window.",
  "Warm stone, sand, linen and sage palette; matte unglazed ceramic, linen, pebble, wood, glass with water, dried herbs.",
  "Low saturation, gentle warm shift, soft highlights. No HDR crunch, no glossy spa styling, no lens flare, no text.",
  "Tactile, matte, slightly rough surfaces — never lacquered.",
].join(" ");

const ROLES = {
  backdrop: {
    ratio: "21x9",
    prompt: [
      "A wide still-life backdrop for a website hero.",
      "At most three objects, arranged low and to one side.",
      "Large calm empty area for headline text — keep that area free of objects and of any drawn marks.",
    ].join(" "),
  },
  object: {
    ratio: "4x5",
    prompt: [
      "A single product object, centred, on a seamless matte background of the same warm sand tone as the surface behind it.",
      "One object plus one herbal detail. Soft shadow, one light direction.",
    ].join(" "),
  },
  practice: {
    ratio: "3x2",
    prompt: [
      "A person in embodied practice — hands, breath, water, table, mat.",
      "No large faces, no yoga-stock posing. Bodily and true, not staged.",
    ].join(" "),
  },
};

const VARIANTS = {
  light: "Light variant: warm sand and linen, bright airy room.",
  dark: "Dark variant: deep charcoal-green background, low warm key light, ceramic and dried herbs catching the light.",
};

function parseArgs(argv) {
  const args = {
    role: "backdrop",
    subject: null,
    variant: "light",
    ratio: null,
    refs: [],
    n: 1,
    out: "public/cw/img/_staging",
    grade: false,
    gradeProfile: null,
    dryRun: false,
    listModels: false,
    noRef: false,
    seed: null,
    extra: "",
    model: null,
    resolution: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--role") args.role = argv[++i];
    else if (arg === "--subject") args.subject = argv[++i];
    else if (arg === "--variant") args.variant = argv[++i];
    else if (arg === "--ratio") args.ratio = argv[++i];
    else if (arg === "--ref") args.refs.push(argv[++i]);
    else if (arg === "--n") args.n = Number(argv[++i]);
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--grade") args.grade = true;
    else if (arg === "--grade-profile") args.gradeProfile = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--list-models") args.listModels = true;
    else if (arg === "--no-ref") args.noRef = true;
    else if (arg === "--seed") args.seed = Number(argv[++i]);
    else if (arg === "--extra") args.extra = argv[++i];
    else if (arg === "--model") args.model = argv[++i];
    else if (arg === "--resolution") args.resolution = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.listModels) {
    if (!ROLES[args.role]) throw new Error(`unknown role "${args.role}" (have: ${Object.keys(ROLES).join(", ")})`);
    if (!VARIANTS[args.variant]) throw new Error(`unknown variant "${args.variant}"`);
    if (!args.subject) throw new Error("--subject is required, e.g. --subject way21");
    args.ratio ??= ROLES[args.role].ratio;
  }
  return args;
}

function buildPrompt(args) {
  const aspect = args.ratio.replace("x", ":");
  return [
    ROLES[args.role].prompt,
    `Subject: ${args.subject.replace(/-/g, " ")}.`,
    VARIANTS[args.variant],
    CONTRACT,
    args.extra,
    args.refs.length && !args.noRef
      ? "Match the attached reference frames exactly in light, palette, material and treatment — this is a new frame in that same series, not a new look."
      : "",
    `Aspect ratio ${aspect}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function referenceParts(refs) {
  const parts = [];
  for (const ref of refs) {
    const abs = path.resolve(ROOT, ref);
    const data = await fs.readFile(abs);
    const mediaType = MIME[path.extname(abs).toLowerCase()];
    if (!mediaType) throw new Error(`unsupported reference type: ${ref}`);
    parts.push({ type: "image", image: data, mediaType });
  }
  return parts;
}

/** Gateway adapter. A second adapter would implement the same two functions. */
const gatewayAdapter = {
  async generateWithReference({ prompt, refs, seed, model, resolution }) {
    const { generateText } = await import("ai");
    const result = await generateText({
      model: model ?? MODELS.reference,
      messages: [{ role: "user", content: [...(await referenceParts(refs)), { type: "text", text: prompt }] }],
      ...(seed == null ? {} : { seed }),
      providerOptions: {
        gateway: { tags: ["feature:imagery", "env:local"] },
        /* A hero plate is displayed 1900px wide. The model's default output is
           ~1264px, which is why the first four offer plates read soft on a
           desktop monitor — `--resolution 2K` (or 4K) is not a nicety here. */
        ...(resolution ? { google: { imageConfig: { imageSize: resolution } } } : {}),
      },
    });
    const images = (result.files ?? []).filter((f) => f.mediaType?.startsWith("image/"));
    if (!images.length) {
      throw new Error(`model returned no image (text: ${result.text?.slice(0, 200) ?? "none"})`);
    }
    return images.map((f) => ({ data: Buffer.from(f.uint8Array ?? f.base64, f.uint8Array ? undefined : "base64") }));
  },

  async generateFromText({ prompt, ratio, seed, model }) {
    const { experimental_generateImage: generateImage } = await import("ai");
    const { images } = await generateImage({
      model: model ?? MODELS.text,
      prompt,
      aspectRatio: ratio.replace("x", ":"),
      ...(seed == null ? {} : { seed }),
    });
    return images.map((image) => ({ data: Buffer.from(image.uint8Array) }));
  },
};

async function main() {
  const args = parseArgs(process.argv);
  await loadEnv();

  if (args.listModels) {
    const { gateway } = await import("ai");
    const available = await gateway.getAvailableModels();
    for (const model of available.models ?? available) {
      if (model.modelType === "image" || /image/i.test(model.name ?? "")) {
        console.log(`${model.id}  ${model.name ?? ""}`);
      }
    }
    return;
  }

  const prompt = buildPrompt(args);
  const useRefs = args.refs.length > 0 && !args.noRef;

  if (args.dryRun) {
    console.log(`model:  ${args.model ?? (useRefs ? MODELS.reference : MODELS.text)}`);
    console.log(`refs:   ${useRefs ? args.refs.join(", ") : "(none — text mode, style will drift)"}`);
    console.log(`out:    ${args.out}/${args.role}-${args.subject}-${args.variant}-${args.ratio}-N.png`);
    console.log(`prompt: ${prompt}`);
    return;
  }

  const outDir = path.resolve(ROOT, args.out);
  await fs.mkdir(outDir, { recursive: true });

  const written = [];
  for (let i = 1; i <= args.n; i += 1) {
    const seed = args.seed == null ? null : args.seed + i - 1;
    const results = useRefs
      ? await gatewayAdapter.generateWithReference({
          prompt,
          refs: args.refs,
          seed,
          model: args.model,
          resolution: args.resolution,
        })
      : await gatewayAdapter.generateFromText({ prompt, ratio: args.ratio, seed, model: args.model });

    for (const [index, image] of results.entries()) {
      const tag = args.model ? `-${args.model.replace(/[/.]/g, "_")}` : "";
      const suffix = `${tag}${results.length > 1 ? `-${i}${String.fromCharCode(97 + index)}` : `-${i}`}`;
      const raw = path.join(outDir, `${args.role}-${args.subject}-${args.variant}-${args.ratio}${suffix}.png`);
      await fs.writeFile(raw, image.data);
      written.push(raw);
      console.log(`raw    ${path.relative(ROOT, raw)}`);

      if (args.grade) {
        const { gradeImage } = await import("./grade.mjs");
        const graded = raw.replace(/\.png$/, ".webp");
        await gradeImage(raw, {
          out: graded,
          profile: args.gradeProfile ?? (args.role === "practice" ? "practice" : "default"),
        });
        console.log(`graded ${path.relative(ROOT, graded)}`);
      }
    }
  }

  console.log(`\n${written.length} frame(s) in ${path.relative(ROOT, outDir)} — staging only, nothing is wired up.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
