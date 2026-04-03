import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = typeof user.email === "string" ? user.email.toLowerCase() : null;
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null;
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user.user_metadata?.picture === "string"
      ? user.user_metadata.picture
      : null;
  const provider = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers[0] ?? null
    : typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : null;

  const db = adminClient();

  const { error } = await db.from("platform_users").upsert(
    {
      auth_user_id: user.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      provider,
      last_sign_in_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: user.id, email });
}
