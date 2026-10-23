import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/auth/adminClient";
import { accountAvatar } from "@/lib/auth/accountIdentity";

async function resolveUser(
  req: NextRequest,
): Promise<{ id: string; meta: Record<string, unknown> | undefined } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token) return null;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user ? { id: user.id, meta: user.user_metadata } : null;
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  let userMeta: Record<string, unknown> | undefined;
  try {
    const user = await resolveUser(req);
    userId = user?.id ?? null;
    userMeta = user?.meta;
  } catch {
    return NextResponse.json({ error: "Auth provider unavailable" }, { status: 503 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminClient();

  const { error: upsertErr } = await db
    .from("user_roles")
    .upsert({ user_id: userId, role: "user" }, { onConflict: "user_id", ignoreDuplicates: true });
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const { data, error: readErr } = await db.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  /* Whether this account authors anything, asked here rather than from its own
     endpoint. The header's standing rule is one request per session, and the
     app switcher needs both answers to decide the builder entry — a second
     round trip for the second half would break the rule to save a join.

     Ownership is per row (`lms_courses.author_id`), never a global role: see
     `src/lib/lms/builderAccess.ts`. A failed read answers `false`, which hides
     a link rather than offering one the builder would then 404. */
  const { data: authored } = await db.from("lms_courses").select("id").eq("author_id", userId).limit(1);

  const { data: authorProfile } = await db.from("lms_authors").select("id").eq("auth_user_id", userId).limit(1);

  return NextResponse.json({
    ok: true,
    role: typeof data?.role === "string" ? data.role : "user",
    authorsCourses:
      (Array.isArray(authored) && authored.length > 0) || (Array.isArray(authorProfile) && authorProfile.length > 0),
    /* The account's face as the server has it now (G 23.10): the header's
       session token can be older than the last change of photo. */
    face: accountAvatar(userMeta),
  });
}
