import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function requireAdminSession(req: NextRequest) {
    return requireAdmin(req);
}

export function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function badRequestResponse(error: string) {
    return NextResponse.json({ error }, { status: 400 });
}

export function serverErrorResponse(error: string) {
    return NextResponse.json({ error }, { status: 500 });
}

export function parseLimitOffset(
    searchParams: URLSearchParams,
    { defaultLimit, maxLimit }: { defaultLimit: number; maxLimit: number }
) {
    // `Number("abc")` is NaN, and `.range(NaN, NaN)` is a PostgREST 400 that
    // reads as a broken page. A value that is not a whole number falls back.
    const wholeOr = (raw: string | null, fallback: number) => {
        const n = Number(raw);
        return raw !== null && Number.isInteger(n) && n >= 0 ? n : fallback;
    };
    const limit = Math.min(wholeOr(searchParams.get("limit"), defaultLimit), maxLimit);
    const offset = wholeOr(searchParams.get("offset"), 0);
    return { limit, offset };
}
