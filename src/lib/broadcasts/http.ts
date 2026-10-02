import { NextResponse } from "next/server";

import { log } from "@/lib/logger";
import { BroadcastError } from "./server";

/** A `BroadcastError` as the JSON its code and status say; anything else as a 500 with the message logged. */
export function broadcastErrorResponse(error: unknown, scope: string) {
  if (error instanceof BroadcastError) {
    if (error.status >= 500) log.error(`broadcasts.${scope}_failed`, { message: error.message, ...error.extra });
    return NextResponse.json({ error: error.code, ...error.extra }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  log.error(`broadcasts.${scope}_failed`, { message });
  return NextResponse.json({ error: message }, { status: 500 });
}

/** The JSON body, or null when there is none or it does not parse. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
