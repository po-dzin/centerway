/**
 * `window.fbq`, typed. This declaration lived in pixel.ts beside an
 * `initPixel`/`trackEvent` pair nothing imported since PixelProvider took over;
 * the functions went on 2026-09-11, the declaration is what stayed.
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
export {};
