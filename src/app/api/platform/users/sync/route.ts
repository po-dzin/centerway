import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { linkPurchasesToAccount } from "@/lib/platform/linkPurchases";

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

  // Claim purchases made before this account existed. Checkout only knows an
  // email, so without this step `customers.auth_user_id` stays NULL and the
  // learner owns nothing as far as the LMS and the profile are concerned.
  // Failure here must not break sign-in — the account is already saved above.
  let purchaseLink: Awaited<ReturnType<typeof linkPurchasesToAccount>> | { linked: 0; reason: "failed" } = {
    linked: 0,
    reason: "failed",
  };

  try {
    purchaseLink = await linkPurchasesToAccount({
      authUserId: user.id,
      email,
      // Supabase sets this for OAuth providers and after email confirmation.
      emailVerified: Boolean(user.email_confirmed_at),
    });
  } catch (linkError) {
    console.error("platform_user_sync_link_failed", {
      userId: user.id,
      error: linkError instanceof Error ? linkError.message : String(linkError),
    });
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    email,
    purchasesLinked: purchaseLink.linked,
    purchaseLinkReason: purchaseLink.reason,
  });
}
