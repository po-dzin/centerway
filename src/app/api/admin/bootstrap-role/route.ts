import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/auth/adminClient";

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    userId = await resolveUserId(req);
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

  const { data, error: readErr } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    role: typeof data?.role === "string" ? data.role : "user",
  });
}
