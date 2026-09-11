import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";

import { AccessError } from "@/lib/admin/access";
import { errorMessage } from "@/lib/errors";
import { log } from "@/lib/logger";

/**
 * The one shape every route answers a failure in, and the one place a thrown
 * value becomes an HTTP status.
 *
 * Seventy-four handlers, three hundred hand-written `NextResponse.json({error})`
 * calls, seventeen with no try/catch at all: an unexpected throw in those was an
 * unshaped 500 with a stack trace in the body. `withRoute` is the try/catch,
 * `fail` is the envelope, `parseBody` is the 400.
 *
 * The envelope is `{ error, details?, requestId }`. `error` is a stable
 * snake_case code a client may branch on; `details` is prose for a human;
 * `requestId` is echoed in the `x-request-id` header and in the log line, so a
 * screenshot of an error can be found in the logs.
 */
export type RouteContext<P = Record<string, string | string[]>> = { params: Promise<P> };

type Handler<P> = (req: NextRequest, ctx: RouteContext<P> & { requestId: string }) => Promise<Response>;

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function fail(status: number, error: string, details?: string, requestId?: string): NextResponse {
  const body: Record<string, unknown> = { error };
  if (details) body.details = details;
  if (requestId) body.requestId = requestId;
  const res = NextResponse.json(body, { status });
  if (requestId) res.headers.set("x-request-id", requestId);
  return res;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

function isPostgrestError(e: unknown): e is { message: string; code: string; details?: string | null } {
  return !!e && typeof e === "object" && "code" in e && "message" in e && !("status" in e);
}

/**
 * Wraps a handler in the try/catch every route should have had.
 *
 * `AccessError` carries its own status. `ZodError` is a 400 (a schema the
 * handler applied itself). A PostgREST error is a 500 the CLIENT sees as
 * `db_error` — its message names tables and columns and belongs in the log,
 * not the response. Everything else is `internal`.
 */
export function withRoute<P = Record<string, string | string[]>>(name: string, handler: Handler<P>) {
  // The context is REQUIRED, not optional: `next build` type-checks every
  // route export against its own `RouteContext` and rejects `| undefined`. A
  // test calls the handler the way Next does — with a context.
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? newRequestId();
    try {
      const res = await handler(req, { params: ctx.params, requestId });
      if (!res.headers.has("x-request-id")) res.headers.set("x-request-id", requestId);
      return res;
    } catch (e) {
      if (e instanceof AccessError) {
        return fail(e.status, e.message, undefined, requestId);
      }
      if (e instanceof ZodError) {
        return fail(400, "invalid_input", issuesText(e), requestId);
      }
      if (isPostgrestError(e)) {
        log.error("route.db_error", { route: name, requestId, code: e.code, message: e.message, details: e.details });
        return fail(500, "db_error", undefined, requestId);
      }
      log.error("route.unhandled", { route: name, requestId, message: errorMessage(e) });
      return fail(500, "internal", undefined, requestId);
    }
  };
}

function issuesText(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * The request body, validated, or the 400 that says why.
 *
 * `const body = (await req.json().catch(() => null)) as { slug?: unknown }`
 * was the pattern in 38 routes: a cast is not a check. This reads, parses and
 * narrows in one call, and the caller writes `if (!parsed.ok) return
 * parsed.response;` — one line, and `parsed.data` is typed by the schema.
 */
export async function parseBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<Parsed<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail(400, "invalid_json") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: fail(400, "invalid_body", issuesText(result.error)) };
  }
  return { ok: true, data: result.data };
}

/** Same for the query string, read as a flat object of the first value per key. */
export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): Parsed<z.infer<S>> {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: fail(400, "invalid_query", issuesText(result.error)) };
  }
  return { ok: true, data: result.data };
}
