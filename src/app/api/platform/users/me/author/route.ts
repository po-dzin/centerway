/**
 * GET/POST /api/platform/users/me/author — the cabinet's read/write into the
 * caller's own `lms_authors` row.
 *
 * Gated by `isEligibleAuthor`: a learner who has never held a course's
 * `author_id` and has no profile yet gets a plain `eligible: false` rather
 * than an empty editor — the cabinet uses that flag to decide whether to
 * render the section at all.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { getAuthorProfileForUser, upsertAuthorProfile, type AuthorProfileInput } from "@/lib/lms/authors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await getAuthorProfileForUser(user.id);
  return NextResponse.json(result);
}

function readStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function readPhoto(value: unknown): { src: string; alt: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const src = (value as Record<string, unknown>).src;
  const alt = (value as Record<string, unknown>).alt;
  if (typeof src !== "string" || !src || typeof alt !== "string" || !alt) return undefined;
  return { src, alt };
}

function readBackground(value: unknown): { src: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const src = (value as Record<string, unknown>).src;
  return typeof src === "string" && src ? { src } : undefined;
}

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

  const input: AuthorProfileInput = {
    name,
    ...(typeof body.role === "string" && body.role.trim() ? { role: body.role.trim() } : {}),
    ...(typeof body.bio === "string" && body.bio.trim() ? { bio: body.bio.trim() } : {}),
    ...(typeof body.quote === "string" && body.quote.trim() ? { quote: body.quote.trim() } : {}),
    ...(readStringArray(body.credentials) ? { credentials: readStringArray(body.credentials) } : {}),
    ...(readPhoto(body.photo) ? { photo: readPhoto(body.photo) } : {}),
    ...(readBackground(body.background) ? { background: readBackground(body.background) } : {}),
    ...(typeof body.listed === "boolean" ? { listed: body.listed } : {}),
    ...(typeof body.slug === "string" && body.slug.trim() ? { slug: body.slug.trim() } : {}),
  };

  const result = await upsertAuthorProfile(user.id, input);
  if (!result.ok) {
    const status = result.error === "not_an_author" ? 403 : result.error === "slug_conflict" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, author: result.author });
}
