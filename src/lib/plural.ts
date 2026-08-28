/**
 * Ukrainian plural agreement, once.
 *
 * There were three copies of this function — the builder's course view, the
 * offer surface, and a fourth about to be written for the cover badge — and
 * three copies of a grammar rule is three chances for one of them to say
 * «2 днів». It is the same rule everywhere it is needed, so it is one function.
 *
 * `one` for 1, 21, 31…; `few` for 2–4, 22–24…; `many` for everything else,
 * including the 11–14 band that looks like it should take `one` and does not.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
