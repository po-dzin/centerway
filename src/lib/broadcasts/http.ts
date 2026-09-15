import { NextResponse } from "next/server";

import type { AdminSession } from "@/lib/auth/requireAdmin";
import { log } from "@/lib/logger";

import { BroadcastError } from "./server";

/**
 * Reading the base is support's job too; writing to it, or mailing it, is the
 * owner's. `support` sees the section and cannot press «Надіслати».
 */
export function canWriteBroadcasts(session: AdminSession): boolean {
  return session.role === "admin";
}

export function broadcastErrorResponse(error: unknown, scope: string) {
  if (error instanceof BroadcastError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  log.error(`broadcasts.${scope}_failed`, { message });
  return NextResponse.json({ error: `${scope}_failed` }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
