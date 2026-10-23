import { NextRequest, NextResponse } from "next/server";

import { AccessError, isPaymentCurrency } from "@/lib/admin/access";
import { recordProductSale } from "@/lib/admin/manualSale";
import {
  badRequestResponse,
  requireAdminSession,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";

type Body = {
  customerId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  productCode?: string | null;
  otherTitle?: string | null;
  amount?: unknown;
  currency?: unknown;
  paidOn?: string | null;
  note?: string | null;
};

// POST /api/admin/customers/sales — a product sold outside the site («Додати продаж»).
// `support` may record it, as it may record a course sold by hand.
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const body = (await req.json().catch(() => ({}))) as Body;
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return badRequestResponse("amount_invalid");
  if (!isPaymentCurrency(body.currency)) return badRequestResponse("currency_invalid");
  if (!body.customerId && !body.email?.trim() && !body.phone?.trim()) return badRequestResponse("contact_required");

  try {
    const sale = await recordProductSale({
      customerId: body.customerId ?? null,
      person: { name: body.name, email: body.email, phone: body.phone },
      productCode: body.productCode,
      otherTitle: body.otherTitle,
      amount,
      currency: body.currency,
      paidOn: body.paidOn,
      note: body.note,
      actorId: session.user.id,
    });
    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return serverErrorResponse(error instanceof Error ? error.message : "sale_failed");
  }
}
