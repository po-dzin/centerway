/**
 * The formats of one program, from the builder (2026-09-25).
 *
 * GET    /api/lms/authoring/courses/:slug/formats — every format (any review
 *        state), and the programs this identity may put inside one.
 * POST   …/formats                 — a new format, as a draft or sent for approval.
 * PATCH  …/formats  { code, … }    — edit one; `submit: true` sends it to the owner.
 * DELETE …/formats?code=…          — withdraw one that never went on sale.
 *
 * Author or admin of THIS course (`withCourseAccess`). What an author may change
 * — and that the live price is never theirs — is decided in
 * `lib/experiences/formatAuthoring`, not here.
 */

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  FormatError,
  createFormat,
  deleteFormat,
  listCourseFormats,
  listIncludablePrograms,
  updateFormat,
  type FormatInput,
} from "@/lib/experiences/formatAuthoring";
import { withCourseAccess } from "@/lib/lms/courseAccess";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";
import { LMS_AUTHORING_READ, LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

function failed(error: unknown): NextResponse {
  if (error instanceof FormatError) return NextResponse.json({ error: error.code }, { status: error.status });
  return NextResponse.json({ error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
}

function refresh(slug: string) {
  revalidateTag(courseTag(slug), PURGE);
  revalidateTag(COURSE_LIST_TAG, PURGE);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      try {
        const [formats, includable] = await Promise.all([
          listCourseFormats(grant.courseId),
          listIncludablePrograms({
            courseId: grant.courseId,
            authUserId: grant.identity.authUserId,
            isAdmin: grant.identity.isAdmin,
          }),
        ]);
        return NextResponse.json({ formats, includable, isOwner: grant.identity.isAdmin });
      } catch (error) {
        return failed(error);
      }
    },
    LMS_AUTHORING_READ,
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      try {
        const body = ((await req.json().catch(() => null)) ?? {}) as FormatInput;
        const code = await createFormat({
          courseId: grant.courseId,
          authUserId: grant.identity.authUserId,
          isAdmin: grant.identity.isAdmin,
          body,
        });
        refresh(slug);
        return NextResponse.json({ code }, { status: 201 });
      } catch (error) {
        return failed(error);
      }
    },
    LMS_COURSE_WRITE,
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      try {
        const body = ((await req.json().catch(() => null)) ?? {}) as FormatInput & { code?: unknown };
        if (typeof body.code !== "string" || !body.code)
          return NextResponse.json({ error: "format_code_required" }, { status: 400 });
        await updateFormat({
          courseId: grant.courseId,
          authUserId: grant.identity.authUserId,
          isAdmin: grant.identity.isAdmin,
          code: body.code,
          body,
        });
        refresh(slug);
        return NextResponse.json({ ok: true });
      } catch (error) {
        return failed(error);
      }
    },
    LMS_COURSE_WRITE,
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withCourseAccess(
    req,
    slug,
    async (grant) => {
      try {
        const code = req.nextUrl.searchParams.get("code");
        if (!code) return NextResponse.json({ error: "format_code_required" }, { status: 400 });
        await deleteFormat({ courseId: grant.courseId, isAdmin: grant.identity.isAdmin, code });
        refresh(slug);
        return NextResponse.json({ ok: true });
      } catch (error) {
        return failed(error);
      }
    },
    LMS_COURSE_WRITE,
  );
}
