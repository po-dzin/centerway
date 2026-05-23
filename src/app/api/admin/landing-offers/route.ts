import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminClient } from "@/lib/auth/adminClient";
import { badRequestResponse, forbiddenResponse, requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";
import { issueIremPersonalOffer, issueIremPersonalOffersBatch } from "@/lib/landing/offers";

type Body = {
  product?: unknown;
  recipient_key?: unknown;
  recipient_keys?: unknown;
  entries?: unknown;
  channel?: unknown;
  campaign?: unknown;
  note?: unknown;
};

type Entry = {
  recipientKey: string;
  channel: string | null;
  campaign: string | null;
  note: string | null;
};

function isPersonalOfferSchemaError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("personal_offer_tokens") &&
    (
      normalized.includes("schema cache") ||
      normalized.includes("could not find the 'status' column") ||
      normalized.includes("does not exist")
    )
  );
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeEntries(body: Body | null): Entry[] {
  const commonChannel = asString(body?.channel);
  const commonCampaign = asString(body?.campaign);
  const commonNote = asString(body?.note);
  const entries: Entry[] = [];

  if (Array.isArray(body?.entries)) {
    for (const item of body.entries) {
      if (!item || typeof item !== "object") continue;
      const recipientKey = asString((item as Record<string, unknown>).recipient_key ?? (item as Record<string, unknown>).recipientKey);
      if (!recipientKey) continue;
      entries.push({
        recipientKey,
        channel: asString((item as Record<string, unknown>).channel) ?? commonChannel,
        campaign: asString((item as Record<string, unknown>).campaign) ?? commonCampaign,
        note: asString((item as Record<string, unknown>).note) ?? commonNote,
      });
    }
  }

  if (Array.isArray(body?.recipient_keys)) {
    for (const item of body.recipient_keys) {
      const recipientKey = asString(item);
      if (!recipientKey) continue;
      entries.push({
        recipientKey,
        channel: commonChannel,
        campaign: commonCampaign,
        note: commonNote,
      });
    }
  }

  const singleRecipientKey = asString(body?.recipient_key);
  if (singleRecipientKey) {
    entries.push({
      recipientKey: singleRecipientKey,
      channel: commonChannel,
      campaign: commonCampaign,
      note: commonNote,
    });
  }

  return entries;
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();

  const body = (await req.json().catch(() => null)) as Body | null;
  const product = asString(body?.product) ?? "irem";
  if (product !== "irem") {
    return badRequestResponse("unsupported_product");
  }
  const entries = normalizeEntries(body);
  if (entries.length === 0) {
    return badRequestResponse("recipient_key required");
  }
  if (entries.length > 500) {
    return badRequestResponse("too_many_recipient_keys");
  }

  try {
    const db = adminClient();
    const batchId = crypto.randomUUID();
    if (entries.length === 1) {
      const issued = await issueIremPersonalOffer({
        product: "irem",
        recipientKey: entries[0].recipientKey,
        channel: entries[0].channel,
        campaign: entries[0].campaign,
        note: entries[0].note,
        batchId,
      });

      await db.from("audit_log").insert({
        actor_id: session.user.id,
        action: "landing_offer.create_draft",
        entity_type: "personal_offer_token",
        entity_id: issued.offerToken,
        metadata: {
          product: issued.product,
          offer_id: issued.offerId,
          recipient_key: entries[0].recipientKey,
          status: issued.status,
          channel: entries[0].channel,
          campaign: entries[0].campaign,
          batch_id: batchId,
        },
      });

      return NextResponse.json({
        ok: true,
        batchId,
        offer: issued,
        offers: [issued],
        summary: {
          totalRequested: 1,
          totalIssued: 1,
          totalDeduped: 0,
        },
      });
    }

    const issuedBatch = await issueIremPersonalOffersBatch({
      product: "irem",
      entries: entries.map((entry) => ({
        product: "irem",
        recipientKey: entry.recipientKey,
        channel: entry.channel,
        campaign: entry.campaign,
        note: entry.note,
        batchId,
      })),
    });

    if (issuedBatch.offers.length > 0) {
      await db.from("audit_log").insert(
        issuedBatch.offers.map((offer, index) => ({
          actor_id: session.user.id,
          action: "landing_offer.create_draft_batch",
          entity_type: "personal_offer_token",
          entity_id: offer.offerToken,
          metadata: {
            product: offer.product,
            offer_id: offer.offerId,
            recipient_key: issuedBatch.issuedRecipientKeys[index] ?? null,
            status: offer.status,
            channel: entries.find((entry) => entry.recipientKey === issuedBatch.issuedRecipientKeys[index])?.channel ?? null,
            campaign: entries.find((entry) => entry.recipientKey === issuedBatch.issuedRecipientKeys[index])?.campaign ?? null,
            batch_total_requested: issuedBatch.totalRequested,
            batch_total_issued: issuedBatch.totalIssued,
            batch_total_deduped: issuedBatch.totalDeduped,
            batch_id: batchId,
          },
        }))
      );
    }

    return NextResponse.json({
      ok: true,
      batchId,
      offers: issuedBatch.offers,
      summary: {
        totalRequested: issuedBatch.totalRequested,
        totalIssued: issuedBatch.totalIssued,
        totalDeduped: issuedBatch.totalDeduped,
      },
      dedupedRecipientKeys: issuedBatch.dedupedRecipientKeys,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "offer_issue_failed";
    if (isPersonalOfferSchemaError(message)) {
      return serverErrorResponse(
        "personal_offer_tokens schema is outdated in Supabase. Run docs/migration/sql/2026-05-22_personal_offer_tokens_apply_all.sql in Supabase SQL Editor."
      );
    }
    return serverErrorResponse(message);
  }
}
