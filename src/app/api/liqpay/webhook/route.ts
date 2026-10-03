import type { NextRequest } from "next/server";
import { gatewayFor } from "@/lib/payments/gateway";
import { handleGatewayCallback } from "@/lib/payments/gatewayWebhook";

export const runtime = "nodejs";

/**
 * LiqPay's address (`server_url` of every LiqPay invoice). Never rename: it is
 * baked into the invoices already issued. The handler is shared with every
 * gateway (`lib/payments/gatewayWebhook`).
 */
export function POST(req: NextRequest) {
  return handleGatewayCallback(req, gatewayFor("liqpay"));
}
