import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function requireAdminSession(req: NextRequest) {
    return requireAdmin(req);
}

export function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const limit = Math.min(Number(searchParams.get("limit") ?? defaultLimit), maxLimit);
    const offset = Number(searchParams.get("offset") ?? 0);
    return { limit, offset };
}

