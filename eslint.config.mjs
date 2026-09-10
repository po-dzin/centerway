import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  /**
   * THE LAYERS, AS A RULE. app → components → lib → lms-core, and never up.
   * Two upward imports were enough to close a cycle (offers.ts → courseOffer.ts
   * → ProgramDetailPage.tsx → OfferCommerce.tsx → offerCommerce.ts → offers.ts);
   * this is what fails the next one in the editor instead of in an audit.
   * lms-core has its own, stricter guard (scripts/guard-lms-core.mjs).
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
