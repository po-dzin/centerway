import crypto from "crypto";
import { adminClient } from "@/lib/auth/adminClient";
import { PRODUCTS, type SearchParams } from "@/lib/products";

type QueryLike = URLSearchParams | SearchParams | Record<string, string | string[] | undefined> | null | undefined;

type PersonalOfferTokenRow = {
  token: string;
  product_code: string;
  offer_id: string;
  status: string;
  recipient_key: string | null;
  channel: string | null;
  campaign: string | null;
  amount: number | string;
  old_amount: number | string | null;
  currency: string | null;
  issued_at: string | null;
  expires_at: string | null;
  created_at?: string | null;
  metadata: Record<string, unknown> | null;
};

export type LandingResolvedOffer = {
  product: "irem";
  offerId: string;
  amount: number;
  currency: string;
  oldAmount: number | null;
  offerToken: string | null;
  offerRequested: boolean;
  offerApplied: boolean;
  offerExpired: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  recipientKey: string | null;
  campaign: string | null;
  channel: string | null;
  currentPriceLabel: string;
  oldPriceLabel: string | null;
  activeNote: string | null;
  expiredNote: string | null;
  discountPercent: number | null;
};

export type IssuePersonalOfferInput = {
  product: "irem";
  recipientKey: string;
  channel?: string | null;
  campaign?: string | null;
  note?: string | null;
  batchId?: string | null;
};

export type IssuePersonalOfferBatchInput = {
  product: "irem";
  entries: IssuePersonalOfferInput[];
};

export type IssuedPersonalOffer = {
  product: "irem";
  offerId: string;
  offerToken: string;
  recipientKey: string;
  amount: number;
  oldAmount: number;
  currency: string;
  status: "draft" | "active";
  issuedAt: string | null;
  expiresAt: string | null;
  discountPercent: number;
  landingUrl: string;
  batchId: string | null;
};

export type IssueOrReusePersonalOfferResult = {
  offer: IssuedPersonalOffer;
  reused: boolean;
};

export type IssuedPersonalOfferBatch = {
  offers: IssuedPersonalOffer[];
  issuedRecipientKeys: string[];
  totalRequested: number;
  totalIssued: number;
  totalDeduped: number;
  dedupedRecipientKeys: string[];
};

const IREM_PERSONAL_OFFER_ID = "irem_launch_early_bird_2900";
const IREM_PERSONAL_OFFER_PRICE = 2900;
const IREM_PERSONAL_OFFER_OLD_PRICE = 4100;
const IREM_PERSONAL_OFFER_HOURS = 48;
const IREM_PERSONAL_OFFER_CURRENCY = "UAH";

function first(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" && value[0].trim() ? value[0].trim() : null;
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readQueryValue(input: QueryLike, key: string): string | null {
  if (!input) return null;
  if (input instanceof URLSearchParams) {
    return first(input.get(key));
  }
  return first(input[key]);
}

function asPositiveInteger(value: number | string | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatPriceLabel(amount: number, currency: string): string {
  return `${amount.toLocaleString("uk-UA")} ${currency === "UAH" ? "грн" : currency}`;
}

function formatDeadlineLabel(iso: string | null): string | null {
  if (!iso) return null;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Kiev",
  }).format(new Date(timestamp));
}

function computeDiscountPercent(oldAmount: number, amount: number): number {
  const discount = ((oldAmount - amount) / oldAmount) * 100;
  return Math.round(discount);
}

function buildActiveNote(deadlineLabel: string | null): string {
  if (!deadlineLabel) return "Персональна ціна для раннього входу діє ще";
  return `Персональна ціна для раннього входу діє до ${deadlineLabel}`;
}

function buildExpiredNote(deadlineLabel: string | null): string {
  if (!deadlineLabel) return "Термін дії персональної ціни завершився";
  return `Термін дії персональної ціни завершився ${deadlineLabel}`;
}

function buildDraftNote(): string {
  return "Персональна ціна активується при першому вході на лендинг";
}

function getIremLandingBaseUrl(): string {
  return new URL("/", PRODUCTS.irem.approvedUrl).toString();
}

function buildIremLandingUrl(offerToken: string): string {
  const url = new URL(getIremLandingBaseUrl());
  url.searchParams.set("offer_token", offerToken);
  return url.toString();
}

function buildBaseIremOffer(offerRequested: boolean): LandingResolvedOffer {
  const base = PRODUCTS.irem;
  return {
    product: "irem",
    offerId: "irem_main_4100",
    amount: base.amount,
    currency: base.currency,
    oldAmount: null,
    offerToken: null,
    offerRequested,
    offerApplied: false,
    offerExpired: false,
    issuedAt: null,
    expiresAt: null,
    recipientKey: null,
    campaign: null,
    channel: null,
    currentPriceLabel: formatPriceLabel(base.amount, base.currency),
    oldPriceLabel: null,
    activeNote: null,
    expiredNote: null,
    discountPercent: null,
  };
}

function mapPersonalOfferRow(row: PersonalOfferTokenRow, offerToken: string): LandingResolvedOffer {
  const amount = asPositiveInteger(row.amount) ?? IREM_PERSONAL_OFFER_PRICE;
  const oldAmount = asPositiveInteger(row.old_amount) ?? IREM_PERSONAL_OFFER_OLD_PRICE;
  const currency = first(row.currency) ?? IREM_PERSONAL_OFFER_CURRENCY;
  const expiresAt = row.expires_at;
  const deadlineLabel = formatDeadlineLabel(expiresAt);

  return {
    product: "irem",
    offerId: row.offer_id,
    amount,
    currency,
    oldAmount,
    offerToken,
    offerRequested: true,
    offerApplied: true,
    offerExpired: false,
    issuedAt: row.issued_at,
    expiresAt,
    recipientKey: row.recipient_key,
    campaign: row.campaign,
    channel: row.channel,
    currentPriceLabel: formatPriceLabel(amount, currency),
    oldPriceLabel: oldAmount > amount ? formatPriceLabel(oldAmount, currency) : null,
    activeNote: row.status === "draft" ? buildDraftNote() : buildActiveNote(deadlineLabel),
    expiredNote: null,
    discountPercent: oldAmount > amount ? computeDiscountPercent(oldAmount, amount) : null,
  };
}

function mapIssuedPersonalOfferRow(row: PersonalOfferTokenRow): IssuedPersonalOffer {
  const amount = asPositiveInteger(row.amount) ?? IREM_PERSONAL_OFFER_PRICE;
  const oldAmount = asPositiveInteger(row.old_amount) ?? IREM_PERSONAL_OFFER_OLD_PRICE;
  const currency = first(row.currency) ?? IREM_PERSONAL_OFFER_CURRENCY;
  const batchId =
    row.metadata && typeof row.metadata.batch_id === "string" && row.metadata.batch_id.trim()
      ? row.metadata.batch_id.trim()
      : null;

  return {
    product: "irem",
    offerId: row.offer_id,
    offerToken: row.token,
    recipientKey: row.recipient_key ?? "",
    amount,
    oldAmount,
    currency,
    status: row.status === "active" ? "active" : "draft",
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    discountPercent: oldAmount > amount ? computeDiscountPercent(oldAmount, amount) : 0,
    landingUrl: buildIremLandingUrl(row.token),
    batchId,
  };
}

function isReusableDynamicOfferRow(row: PersonalOfferTokenRow): boolean {
  if (row.status === "draft") {
    return true;
  }
  if (row.status !== "active") {
    return false;
  }

  const expiresAtMs = Date.parse(row.expires_at ?? "");
  return Number.isFinite(expiresAtMs) && Date.now() <= expiresAtMs;
}

async function activateDraftIremOffer(offerToken: string): Promise<PersonalOfferTokenRow | null> {
  const db = adminClient();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + IREM_PERSONAL_OFFER_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("personal_offer_tokens")
    .update({
      status: "active",
      issued_at: issuedAt,
      expires_at: expiresAt,
    })
    .eq("token", offerToken)
    .eq("product_code", "irem")
    .eq("status", "draft")
    .select("token, product_code, offer_id, status, recipient_key, channel, campaign, amount, old_amount, currency, issued_at, expires_at, metadata")
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as PersonalOfferTokenRow | null) ?? null;
}

export async function resolveIremLandingOffer(input: QueryLike): Promise<LandingResolvedOffer> {
  const offerToken = first(readQueryValue(input, "offer_token"));
  const base = buildBaseIremOffer(Boolean(offerToken));

  if (!offerToken) {
    return base;
  }

  const db = adminClient();
  const { data, error } = await db
    .from("personal_offer_tokens")
    .select("token, product_code, offer_id, status, recipient_key, channel, campaign, amount, old_amount, currency, issued_at, expires_at, metadata")
    .eq("token", offerToken)
    .eq("product_code", "irem")
    .maybeSingle();

  if (error || !data) {
    return base;
  }

  const row = data as PersonalOfferTokenRow;

  if (row.status === "draft") {
    const activated = await activateDraftIremOffer(offerToken);
    if (activated) {
      return mapPersonalOfferRow(activated, offerToken);
    }
    const { data: refetched } = await db
      .from("personal_offer_tokens")
      .select("token, product_code, offer_id, status, recipient_key, channel, campaign, amount, old_amount, currency, issued_at, expires_at, metadata")
      .eq("token", offerToken)
      .eq("product_code", "irem")
      .maybeSingle();
    if (!refetched) {
      return base;
    }
    return mapPersonalOfferRow(refetched as PersonalOfferTokenRow, offerToken);
  }

  const expiresAtMs = Date.parse(row.expires_at ?? "");
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return {
      ...base,
      offerExpired: true,
      expiredNote: buildExpiredNote(formatDeadlineLabel(row.expires_at ?? "")),
    };
  }

  return mapPersonalOfferRow(row, offerToken);
}

export async function issueIremPersonalOffer(input: IssuePersonalOfferInput): Promise<IssuedPersonalOffer> {
  const recipientKey = input.recipientKey.trim();
  if (!recipientKey) {
    throw new Error("recipient_key_required");
  }

  const offerToken = crypto.randomBytes(18).toString("hex");
  const db = adminClient();

  const { error } = await db.from("personal_offer_tokens").insert({
    token: offerToken,
    product_code: input.product,
    offer_id: IREM_PERSONAL_OFFER_ID,
    status: "draft",
    recipient_key: recipientKey,
    channel: first(input.channel ?? null),
    campaign: first(input.campaign ?? null),
    amount: IREM_PERSONAL_OFFER_PRICE,
    old_amount: IREM_PERSONAL_OFFER_OLD_PRICE,
    currency: IREM_PERSONAL_OFFER_CURRENCY,
    metadata: {
      ...(first(input.note ?? null) ? { note: first(input.note ?? null) } : {}),
      ...(first(input.batchId ?? null) ? { batch_id: first(input.batchId ?? null) } : {}),
    },
  });

  if (error) {
    throw new Error(error.message || "offer_token_insert_failed");
  }

  return {
    product: "irem",
    offerId: IREM_PERSONAL_OFFER_ID,
    offerToken,
    recipientKey,
    amount: IREM_PERSONAL_OFFER_PRICE,
    oldAmount: IREM_PERSONAL_OFFER_OLD_PRICE,
    currency: IREM_PERSONAL_OFFER_CURRENCY,
    status: "draft",
    issuedAt: null,
    expiresAt: null,
    discountPercent: computeDiscountPercent(IREM_PERSONAL_OFFER_OLD_PRICE, IREM_PERSONAL_OFFER_PRICE),
    landingUrl: buildIremLandingUrl(offerToken),
    batchId: first(input.batchId ?? null),
  };
}

export async function issueOrReuseIremPersonalOffer(input: IssuePersonalOfferInput): Promise<IssueOrReusePersonalOfferResult> {
  const recipientKey = input.recipientKey.trim();
  const campaign = first(input.campaign ?? null);

  if (!recipientKey) {
    throw new Error("recipient_key_required");
  }
  if (!campaign) {
    throw new Error("campaign_required");
  }

  const db = adminClient();
  const { data, error } = await db
    .from("personal_offer_tokens")
    .select("token, product_code, offer_id, status, recipient_key, channel, campaign, amount, old_amount, currency, issued_at, expires_at, created_at, metadata")
    .eq("product_code", "irem")
    .eq("recipient_key", recipientKey)
    .eq("campaign", campaign)
    .in("status", ["draft", "active"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message || "offer_token_lookup_failed");
  }

  for (const row of (data as PersonalOfferTokenRow[] | null) ?? []) {
    if (isReusableDynamicOfferRow(row)) {
      return {
        offer: mapIssuedPersonalOfferRow(row),
        reused: true,
      };
    }
  }

  return {
    offer: await issueIremPersonalOffer(input),
    reused: false,
  };
}

export async function issueIremPersonalOffersBatch(input: IssuePersonalOfferBatchInput): Promise<IssuedPersonalOfferBatch> {
  const seen = new Set<string>();
  const dedupedRecipientKeys: string[] = [];
  const uniqueEntries: IssuePersonalOfferInput[] = [];

  for (const rawEntry of input.entries) {
    const recipientKey = rawEntry.recipientKey.trim();
    if (!recipientKey) continue;
    if (seen.has(recipientKey)) {
      dedupedRecipientKeys.push(recipientKey);
      continue;
    }
    seen.add(recipientKey);
    uniqueEntries.push({
      product: input.product,
      recipientKey,
      channel: rawEntry.channel ?? null,
      campaign: rawEntry.campaign ?? null,
      note: rawEntry.note ?? null,
      batchId: rawEntry.batchId ?? null,
    });
  }

  const offers: IssuedPersonalOffer[] = [];
  for (const entry of uniqueEntries) {
    offers.push(await issueIremPersonalOffer(entry));
  }

  return {
    offers,
    issuedRecipientKeys: uniqueEntries.map((entry) => entry.recipientKey),
    totalRequested: input.entries.length,
    totalIssued: offers.length,
    totalDeduped: dedupedRecipientKeys.length,
    dedupedRecipientKeys,
  };
}
