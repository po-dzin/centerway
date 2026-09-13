/**
 * THE SUPPORT BOT'S ADDRESS, ON ITS OWN AND WITH NO IMPORTS.
 *
 * It used to live in `tgSupportBotCopy`, beside the bot's greeting — the right
 * neighbourhood for it, until the footer's social row needed the same address.
 * `tgSupportBotCopy` reads `LEARNING_SHELF_HREF` from `platform/content`, so a
 * `content` → `tgSupportBotCopy` import closed a cycle: at module evaluation
 * `CABINET_URL` reached back for a constant that had not been initialised yet
 * and the whole platform layout threw. Typechecking does not see this; the
 * server does, on the first request.
 *
 * A leaf module is the fix that keeps ONE literal. Both sides import from here,
 * `tgSupportBotCopy` re-exports it so its own callers are untouched, and the
 * URL still exists in exactly one place.
 */
export const SUPPORT_BOT_URL = "https://telegram.me/centerway_support_bot";
