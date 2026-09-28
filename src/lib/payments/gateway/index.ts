import type { GatewayId, PaymentGateway } from "./types";
import { wayforpay } from "./wayforpay";

export type * from "./types";

const GATEWAYS: Record<GatewayId, PaymentGateway> = { wfp: wayforpay };

/**
 * The gateway new invoices are issued through.
 *
 * `PAYMENT_GATEWAY` picks it; unset, or naming a gateway this build does not
 * have, is WayForPay — the one the platform has always sold through. A typo in
 * a dashboard must not stop the checkout.
 */
export function activeGateway(): PaymentGateway {
  const wanted = process.env.PAYMENT_GATEWAY?.trim().toLowerCase();
  return (wanted && wanted in GATEWAYS ? GATEWAYS[wanted as GatewayId] : null) ?? wayforpay;
}

/**
 * The gateway that reported a stored payment (`payments.provider`).
 *
 * Old payments keep their own gateway after a switch: a WayForPay callback
 * stored in March is classified with WayForPay's words, whatever is active now.
 */
/** What the latest stored callback for a payment said, in its own gateway's words. */
export function storedCallbackOutcome(row: { provider?: unknown; raw_payload?: unknown } | null | undefined) {
  if (!row) return null;
  return gatewayFor(typeof row.provider === "string" ? row.provider : null).storedOutcome(row.raw_payload);
}

export function gatewayFor(provider: string | null | undefined): PaymentGateway {
  const key = provider?.trim().toLowerCase();
  return (key && key in GATEWAYS ? GATEWAYS[key as GatewayId] : null) ?? wayforpay;
}
