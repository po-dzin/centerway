import type { CSSProperties } from "react";

/**
 * THE TITLE'S LONGEST WORD, HANDED TO CSS.
 *
 * A hero title is set at a size chosen from the viewport, and a viewport knows
 * nothing about the word it is sizing: «ДІАГНОСТИКА» broke as «ДІАГНОСТИК / А»
 * on a 390px phone at exactly the size that suited «Програми». CSS cannot count
 * the characters in its own text, but the component rendering the string can —
 * so the one fact CSS is missing is passed in, and the stylesheet does the rest
 * (see the note over `.heroFeatureTitle` in PlatformBlocksOrientation.module.css).
 *
 * IT IS THE LONGEST WORD, NOT THE LENGTH. A title wraps between words happily;
 * it may never wrap inside one. So the bound is the widest single word, and a
 * three-word title is free to take three lines at full size.
 */
export function longestWordLength(title: string): number {
  return title
    .split(/\s+/)
    .reduce((longest, word) => Math.max(longest, word.length), 0);
}

/**
 * The style object a hero title carries. Written as a custom property rather
 * than an inline `font-size` on purpose: the size is still the stylesheet's
 * decision at every breakpoint, and this only tells it what it has to fit.
 */
export function heroTitleFit(title: string): CSSProperties {
  return { "--hero-title-word": longestWordLength(title) } as CSSProperties;
}
