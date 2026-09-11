/**
 * One structured logger, one line per event, JSON on the right.
 *
 * `console.error("requireAdmin: Role fetch error", roleError)` prints two
 * things a log search cannot join. `log.error("admin.role_fetch_failed",
 * { requestId, userId, message })` prints one line that Vercel's log drain
 * keeps as fields. No library: the shape is the contract, and a dependency for
 * `JSON.stringify` is a dependency.
 *
 * Event names are dotted, lowercase, and name what HAPPENED rather than where:
 * `payment.webhook_rejected`, not `wfp/webhook/route.ts:412`.
 */
type Fields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

function emit(level: Level, event: string, fields?: Fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};
