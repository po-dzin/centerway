/**
 * The one Meta Pixel this business owns.
 *
 * The static landings carry the same number literally, in
 * `shared/js/landing-pixel.js` — they never load the app bundle and cannot
 * import this. The env override exists so a preview deployment can point at a
 * test pixel without a code change; the default is the production id, because a
 * missing variable must not silently turn tracking off on the surface that
 * confirms payments.
 *
 * The SERVER side reads its own `META_PIXEL_ID` for CAPI (src/lib/tracking/capi.ts).
 * Both must name the same pixel, or the browser event and the server event never
 * deduplicate.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "885125430564169";
