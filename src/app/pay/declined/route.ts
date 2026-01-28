import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const IREM_LP_BASE = process.env.IREM_LP_BASE!;
const SHORT_LP_BASE = process.env.SHORT_LP_BASE!;

function pickBase(orderRef: string) {
  if (orderRef.startsWith("irem_")) return IREM_LP_BASE;
  if (orderRef.startsWith("short_")) return SHORT_LP_BASE;
  return SHORT_LP_BASE;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const orderRef =
    searchParams.get("orderReference") ||
    searchParams.get("order_ref") ||
    "";

  const base = pickBase(orderRef);

  const redirectUrl = new URL("/pay-failed", base);
  if (orderRef) redirectUrl.searchParams.set("order_ref", orderRef);

  return NextResponse.redirect(redirectUrl, 302);
}
