import type { PaymentOutcome } from "@/lib/payments/orderStatus";

/**
 * THE PAYMENT GATEWAY AS ONE BOUNDARY (2026-09-26).
 *
 * WayForPay was known directly by the checkout, the webhook, the return page
 * and the status poll: its field names, its signature formulas, its status
 * words. Choosing a gateway that can split a payment between the platform and
 * an author (LiqPay `split_rules`, see
 * docs/payments/wfp-split-payments-research-2026-09-17.md) would have meant
 * editing all of them. Now a gateway is this interface, and the rest of the
 * payment path speaks only its neutral types — an invoice request in, a
 * callback's outcome out.
 *
 * WHAT STAYS OURS, NOT THE GATEWAY'S: the order reference, the order status
 * machine (`orderStatus.ts`), the order and payment rows, the author shares
 * (`order_shares`, written by the database when an order becomes paid).
 */

export type GatewayId = "wfp";

/**
 * One author's part of a payment, for a gateway that can route it at source.
 * `receiverRef` is the author's identity AT THE GATEWAY
 * (`author_payout_accounts.receiver_ref`).
 */
export type PayoutSplit = {
  receiverRef: string;
  amount: number;
  description: string;
};

export type InvoiceRequest = {
  orderRef: string;
  /** Seconds. Signed by some gateways, so it is fixed by the caller, not read inside. */
  orderDate: number;
  amount: number;
  currency: string;
  /** The line a buyer reads on the gateway's page. */
  lineTitle: string;
  /** Where the buyer lands afterwards. */
  returnUrl: string;
  /** Where the gateway reports the outcome, server to server. */
  callbackUrl: string;
  /**
   * Authors' parts to route at source. Only for a gateway with
   * `supportsSplit`; a gateway without it refuses an invoice that carries any,
   * rather than silently keeping an author's money on the platform's account.
   */
  splits?: PayoutSplit[];
};

export type InvoiceResult =
  { ok: true; payUrl: string } | { ok: false; error: "gateway_no_url" | "gateway_split_unsupported"; raw?: string };

export type SignatureCheck = {
  ok: boolean;
  present: boolean;
  reason: "match" | "mismatch" | "missing_signature" | "missing_secret";
};

/** A server-to-server report, in our words. `raw` is what is stored as `payments.raw_payload`. */
export type GatewayCallback = {
  orderRef: string;
  outcome: PaymentOutcome;
  /** The gateway's own status word, for the event log. */
  rawStatus: string | null;
  /** The gateway's transaction id, when it sent one. */
  providerTxId: string | null;
  /** Unix seconds when the gateway says the payment happened; null when it did not say. */
  occurredAt: number | null;
  /** What the gateway says was charged; null when it did not say. */
  amount: number | null;
  currency: string | null;
  payer: { email: string | null; phone: string | null };
  raw: Record<string, string>;
};

/** The HTTP answer a gateway requires to stop redelivering a callback. */
export type CallbackAck = { status: number; body: unknown };

export interface PaymentGateway {
  readonly id: GatewayId;
  /** Whether an invoice may carry `splits` (money routed to authors at source). */
  readonly supportsSplit: boolean;
  /** Our path the gateway posts callbacks to. Baked into issued invoices — never rename. */
  readonly callbackPath: string;
  /** Environment the gateway cannot work without, by name; empty when complete. */
  missingEnv(): string[];
  createInvoice(request: InvoiceRequest, fetchFn: typeof fetch): Promise<InvoiceResult>;
  verifyCallback(payload: Record<string, string>): SignatureCheck;
  /** `null` when the payload names no order. */
  readCallback(payload: Record<string, string>): GatewayCallback | null;
  /** A stored or returned status word, classified. */
  outcomeOf(rawStatus: string | null | undefined): PaymentOutcome;
  /** What a stored callback (`payments.raw_payload`) said; null when it carried no status. */
  storedOutcome(raw: unknown): PaymentOutcome | null;
  /** `null` when it cannot be produced (no secret): the caller must not claim acceptance. */
  acknowledge(orderRef: string, nowSeconds?: number): CallbackAck | null;
}
