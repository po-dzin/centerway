import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { getOfferMeta } from "@/lib/platform/profile";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = adminClient();
  const normalizedEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : null;

  const [{ data: platformUser }, { data: doshaView, error: doshaViewError }] = await Promise.all([
    db
      .from("platform_users")
      .select("id, auth_user_id, email, full_name, avatar_url")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    db
      .from("v_user_dosha_test_profile")
      .select("user_id, test_id, test_slug, attempt_id, result_type, score_vata, score_pitta, score_kapha, completed_at, version")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const customerQuery = db
    .from("customers")
    .select("id, auth_user_id, email, phone, tg_id, display_name")
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();
  const customerFallbackQuery = normalizedEmail
    ? db
        .from("customers")
        .select("id, auth_user_id, email, phone, tg_id, display_name")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [customerByAuth, customerByEmail] = await Promise.all([customerQuery, customerFallbackQuery]);
  const customer = customerByAuth.data ?? customerByEmail.data ?? null;

  const doshaProfile =
    !doshaViewError && doshaView
      ? {
          attemptId: doshaView.attempt_id,
          testId: doshaView.test_id,
          testSlug: doshaView.test_slug,
          resultType: doshaView.result_type,
          version: doshaView.version,
          completedAt: doshaView.completed_at,
          scores: {
            vata: doshaView.score_vata,
            pitta: doshaView.score_pitta,
            kapha: doshaView.score_kapha,
          },
        }
      : null;

  const ordersQuery = customer?.id
    ? db
        .from("orders")
        .select("id, order_ref, product_code, amount, currency, status, created_at, customer_id")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const ordersResult = await ordersQuery;
  if (ordersResult.error) {
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  }

  const orders = (ordersResult.data ?? []).map((order) => {
    const offer = getOfferMeta(order.product_code);
    return {
      ...order,
      title: offer.title,
      offerKind: offer.kind,
      offerCode: offer.code,
    };
  });

  const orderRefs = orders.map((order) => order.order_ref).filter(Boolean);
  const accessTokensResult =
    orderRefs.length > 0
      ? await db
          .from("access_tokens")
          .select("order_ref, used, expires_at, created_at")
          .in("order_ref", orderRefs)
          .order("created_at", { ascending: false })
      : { data: [], error: null as { message?: string } | null };

  if (accessTokensResult.error) {
    return NextResponse.json({ error: accessTokensResult.error.message ?? "access_tokens_fetch_failed" }, { status: 500 });
  }

  const accessTokens = accessTokensResult.data ?? [];
  const tokenByOrderRef = new Map(accessTokens.map((token) => [token.order_ref, token]));

  const purchases = orders
    .filter((order) => order.status === "paid")
    .map((order) => ({
      orderRef: order.order_ref,
      offerCode: order.offerCode,
      offerKind: order.offerKind,
      title: order.title,
      amount: order.amount,
      currency: order.currency,
      createdAt: order.created_at,
      access: tokenByOrderRef.get(order.order_ref) ?? null,
    }));

  return NextResponse.json({
    userId: user.id,
    profile: {
      account: {
        email: user.email ?? platformUser?.email ?? customer?.email ?? null,
        fullName:
          (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
          (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null) ??
          platformUser?.full_name ??
          customer?.display_name ??
          null,
        avatarUrl:
          (typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null) ??
          (typeof user.user_metadata?.picture === "string" ? user.user_metadata.picture : null) ??
          platformUser?.avatar_url ??
          null,
      },
      contacts: customer
        ? {
            phone: customer.phone ?? null,
            telegram: customer.tg_id ?? null,
          }
        : null,
      dosha: doshaProfile,
      purchases,
      progress: {
        items: [],
        note: "Цей блок збирає карту проходження: активні маршрути, завершені етапи і доречний наступний крок у платформі.",
      },
    },
  });
}
