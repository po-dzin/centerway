import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Rules that used to live in `scripts/guard-*.mjs` as line regexes.
 *
 * A grep cannot tell a string from an expression or a comment from code, and it
 * only speaks once CI runs. Everything below is the same rule expressed against
 * the syntax tree: exact, and underlined in the editor while the line is still
 * being typed. What stayed in the scripts stayed because ESLint cannot see it —
 * CSS, HTML, JSON manifests, and files that must not exist.
 */

/** The layout tags a public route file must not author itself. */
const STRUCTURAL_TAGS = ["main", "section", "aside", "nav", "header"];

/**
 * The admin is grey on purpose. Same alternation the governance guard grepped,
 * now matched against string literals only — so a comment naming the rule is no
 * longer a violation of it.
 */
const ADMIN_FORBIDDEN_CLASS =
  "(?:text|bg|border|from|to|ring|divide|hover:bg|hover:text)-(?:blue|indigo|emerald|purple|green|yellow|red|gray)-|bg-gradient|text-transparent";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  /**
   * THE LAYERS, AS A RULE. app → components → lib → lms-core, and never up.
   * Two upward imports were enough to close a cycle (offers.ts → courseOffer.ts
   * → ProgramDetailPage.tsx → OfferCommerce.tsx → offerCommerce.ts → offers.ts);
   * this is what fails the next one in the editor instead of in an audit.
   */
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    // A test may reach anywhere it needs to assert; the rule is for the code.
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/components/*", "@/app/*"], message: "lib must not import from components or app — move the type or the module down." }] }],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/app/*"], message: "components must not import from app." }] }],
    },
  },

  /**
   * THE CORE STAYS PORTABLE. src/lms-core is the shared brain for the web
   * cabinet today and for a native app or Telegram Mini App later
   * (docs/lms-research-2026-08-15.md §5A). A package boundary would enforce
   * this; the repo is one npm app, so the boundary is enforced here and a later
   * move to packages/ stays a folder move.
   *
   * Zero dependencies means exactly that: only relative siblings. React, Next,
   * Supabase, `node:*` and the `@/` alias are the ones that keep being reached
   * for, but the rule is the general one — anything that is not `./` or `../`
   * is a dependency the core may not have.
   */
  {
    files: ["src/lms-core/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^[^.]/]",
          message: "lms-core must have zero dependencies — only relative sibling imports. Move platform-specific code into src/lib or src/components.",
        },
        {
          selector: ":matches(ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^[^.]/]",
          message: "lms-core must have zero dependencies — only relative sibling re-exports.",
        },
        {
          selector: ":matches(JSXElement, JSXFragment)",
          message: "JSX in lms-core means a renderer leaked in — renderers belong in src/components.",
        },
      ],
      /**
       * The other half of portability: globals that exist only in a browser or
       * on a Node server. The core takes its configuration as arguments and does
       * no I/O, so none of these may be reached for. Scope-aware, unlike the
       * grep it replaces — a local named `document` is not a DOM access.
       */
      "no-restricted-globals": [
        "error",
        { name: "window", message: "lms-core must run outside a browser — no DOM access." },
        { name: "document", message: "lms-core must run outside a browser — no DOM access." },
        { name: "navigator", message: "lms-core must run outside a browser — no DOM access." },
        { name: "localStorage", message: "lms-core must run outside a browser — storage is the caller's job." },
        { name: "sessionStorage", message: "lms-core must run outside a browser — storage is the caller's job." },
        { name: "fetch", message: "lms-core must stay pure — network I/O belongs to the caller." },
        { name: "process", message: "lms-core takes its configuration as arguments, not from process.env." },
      ],
    },
  },

  /**
   * PUBLIC ROUTE FILES COMPOSE, THEY DO NOT DRAW. A page under (platform) picks
   * the data and hands it to a shared platform component. The moment it opens a
   * <section> or imports a stylesheet, the same layout exists in two places and
   * the design system has stopped being one source. The admin is excluded: it is
   * a different surface with its own contract.
   */
  {
    files: ["src/app/(platform)/**/page.tsx"],
    ignores: ["src/app/(platform)/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["*.css", "**/*.css"], message: "Route files must not import CSS directly — delegate to a shared platform component or template." },
            { group: ["*PlatformContentStyles*", "**/PlatformContentStyles*"], message: "Route files must not import PlatformContentStyles directly — use an approved shared platform component." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/(platform)/**/page.tsx"],
    /**
     * Two pages are exempt and stay exempt: the funnel entry renders a landing
     * document rather than a platform screen, and the lesson pilot is the
     * prototype the reader was built from.
     */
    ignores: [
      "src/app/(platform)/admin/**",
      "src/app/(platform)/funnel-entry/\\[product\\]/page.tsx",
      "src/app/(platform)/lesson/pilot/page.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXOpeningElement[name.name=/^(${STRUCTURAL_TAGS.join("|")})$/]`,
          message: "Route files must not author structural layout tags — move the composition into a shared platform component or template.",
        },
      ],
    },
  },

  /**
   * THE ADMIN IS GREY. These utilities were grepped out of the admin scope by
   * scripts/guard-admin-governance.mjs; the hex and globals.css halves of that
   * guard stay there, because neither of them is JavaScript.
   */
  {
    files: ["src/app/(platform)/admin/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${ADMIN_FORBIDDEN_CLASS}/]`,
          message: "Tailwind colour and gradient utilities are forbidden here — the admin is grey, and colour comes from the design tokens.",
        },
        {
          selector: `TemplateElement[value.raw=/${ADMIN_FORBIDDEN_CLASS}/]`,
          message: "Tailwind colour and gradient utilities are forbidden here — the admin is grey, and colour comes from the design tokens.",
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".github/**",
    "docs/**",
    "src/landing-static/**",
  ]),
]);

export default eslintConfig;
