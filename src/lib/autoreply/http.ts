import { NextResponse } from "next/server";

import { log } from "@/lib/logger";

import { AutoreplyError } from "./rules";

/** An `AutoreplyError` as the JSON its code and status say; anything else as a 500 with the message logged. */
export function autoreplyErrorResponse(error: unknown, scope: string) {
  if (error instanceof AutoreplyError) {
    if (error.status >= 500) log.error(`autoreply.${scope}_failed`, { message: error.message });
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  log.error(`autoreply.${scope}_failed`, { message });
  return NextResponse.json({ error: message }, { status: 500 });
}
