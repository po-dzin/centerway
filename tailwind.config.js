/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      /* ONE RADIUS SCALE IN THE PRODUCT (2026-09-07).
       *
       * This file was `extend: {}`, which is not "no opinion" — it is Tailwind's
       * own scale (6 · 8 · 12 · 16 · 24 · 9999), running underneath the Control
       * Panel while the platform ran `--cw-radius-*` (6 · 12 · 16 · 20 · 28 ·
       * pill). Two scales, and the collision was in the NAMES: `lg` meant 20px
       * on a platform surface and 8px on an admin one, two and a half times
       * apart, on screens a person crosses in one click. 83 declarations sat on
       * the second scale.
       *
       * The names stay Tailwind's — rewriting 83 call sites would be a second
       * change riding on this one — and each is re-pointed at the platform step
       * that matches WHAT THE CLASS IS ACTUALLY USED ON here, not at the
       * nearest number:
       *
       *   rounded-lg   → md 16   the panel's rows and controls
       *   rounded-xl   → lg 20   its cards
       *   rounded-2xl  → xl 28   its full-width plates (`cw-surface` panels),
       *                          the same family as the platform's sheets and
       *                          drawers, which take `xl` today
       *   rounded-3xl  → xl 28   two call sites, folded into the plate step
       *   rounded-md   → sm 12   details inside something else
       *   rounded-sm   → inset 6
       *
       * The ladder stays monotonic, so a class that used to be one step below
       * another still is. See docs/design-system/geometry-audit-2026-09-07.md.
       */
      borderRadius: {
        none: "0",
        sm: "var(--cw-radius-inset)",
        DEFAULT: "var(--cw-radius-sm)",
        md: "var(--cw-radius-sm)",
        lg: "var(--cw-radius-md)",
        xl: "var(--cw-radius-lg)",
        "2xl": "var(--cw-radius-xl)",
        "3xl": "var(--cw-radius-xl)",
        full: "var(--cw-radius-pill)",
      },
    },
  },
  plugins: [],
}
