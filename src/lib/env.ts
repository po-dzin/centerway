import { z } from "zod";

/**
 * The environment, read through a schema instead of `process.env.X!`.
 *
 * Grouped by what a caller is about to do, and parsed on each call rather than
 * once at import: a build renders some routes with no env at all, and a test
 * sets a variable and expects the next read to see it. Parsing is a few
 * microseconds; a wrong value at import time is a build that fails for a route
 * that never needed the key.
 *
 * A missing key throws with the NAMES of what is missing. That is the whole
 * point: `process.env.WFP_SECRET_KEY!` reads as `undefined`, signs nothing, and
 * the payment callback is quietly refused — this throws
 * `env(wfp): missing WFP_SECRET_KEY` on the first request that needs it.
 */
function group<S extends z.ZodRawShape>(name: string, shape: S) {
  const schema = z.object(shape);
  return (): z.infer<typeof schema> => {
    const parsed = schema.safeParse(process.env);
    if (parsed.success) return parsed.data;
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`env(${name}): ${issues}`);
  };
}

const nonEmpty = z.string().min(1, "missing");

export const env = {
  /** Server-side Supabase: the service role. Never reachable from a client bundle. */
  supabaseService: group("supabaseService", {
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  }),
  /** The anon pair, also used server-side to verify a Bearer token. */
  supabasePublic: group("supabasePublic", {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  }),
  wfp: group("wfp", {
    WFP_MERCHANT_ACCOUNT: nonEmpty,
    WFP_SECRET_KEY: nonEmpty,
    WFP_MERCHANT_DOMAIN: nonEmpty,
  }),
  cron: group("cron", {
    CRON_SECRET: nonEmpty,
  }),
  telegram: group("telegram", {
    TELEGRAM_BOT_TOKEN: nonEmpty,
    TELEGRAM_WEBHOOK_SECRET: nonEmpty,
    SUPPORT_CHAT_ID: nonEmpty,
    SUPPORT_THREAD_ID: z.string().optional(),
    BUG_REPORTS_THREAD_ID: z.string().optional(),
    LEADS_THREAD_ID: z.string().optional(),
  }),
};

/** True when the public Supabase pair is configured — the browser client's guard. */
export function hasPublicSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
