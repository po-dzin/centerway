import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Liveness that actually asks the database.
 *
 * It used to return `{ ok: true }` unconditionally, which made it useless as a
 * probe: the one failure an uptime check exists to catch — the app is up and
 * Postgres is not — was the exact failure it could not see. A green board while
 * every checkout 500s is worse than no board.
 *
 * TWO AUDIENCES, TWO ANSWERS. Anonymous callers get liveness and nothing else:
 * this endpoint is public, and pending/failed job counts are a readable measure
 * of how much this business is selling. A caller holding CRON_SECRET — the
 * uptime monitor, the operator — gets the queue depth too, because "up" is not
 * the same question as "healthy" when the worker has been stalled for a day.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QueueDepth = { pending: number; failed: number; running: number };

async function readQueueDepth(sb: ReturnType<typeof supabaseAdmin>): Promise<QueueDepth | null> {
  const counts = await Promise.all(
    (["pending", "failed", "running"] as const).map((status) =>
      sb.from("jobs").select("id", { count: "exact", head: true }).eq("status", status)
    )
  );
  if (counts.some((result) => result.error)) return null;
  const [pending, failed, running] = counts.map((result) => result.count ?? 0);
  return { pending, failed, running };
}

export async function GET(req: Request) {
  const ts = Date.now();

  /* One row, and NO COUNT. The first version of this asked for
     `{ count: "exact", head: true }`, which reads like a cheap probe and is
     not: `limit(1)` bounds the rows returned, not the count, so Postgres still
     walked the whole of `jobs` to total it. `jobs` is append-only — 15k rows
     and growing — and this endpoint is public and meant to be polled, so the
     cost of a liveness check grew with the job history forever.

     Exact counts still happen below, where they are the actual question being
     asked and only an authenticated caller can ask it. */
  let dbUp = false;
  let sb: ReturnType<typeof supabaseAdmin> | null = null;
  try {
    sb = supabaseAdmin();
    const { error } = await sb.from("jobs").select("id").limit(1);
    dbUp = !error;
  } catch {
    dbUp = false;
  }

  const secret = process.env.CRON_SECRET;
  const authorized =
    Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;

  const body: Record<string, unknown> = { ok: dbUp, db: dbUp ? "up" : "down", ts };

  if (authorized && dbUp && sb) {
    const queue = await readQueueDepth(sb);
    if (queue) body.queue = queue;
  }

  // 503, not 200-with-a-flag: a monitor reads the status line, and an endpoint
  // that answers 200 while reporting `db: "down"` is a monitor that stays green.
  return NextResponse.json(body, { status: dbUp ? 200 : 503 });
}
