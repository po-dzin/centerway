/**
 * «Облік» — the author's own record of what their work earned (2026-10-14).
 *
 * WHAT CHANGED SINCE THE OVERVIEW SAID «NO MONEY». The workshop overview kept
 * money out on purpose: prices sat behind an admin-only policy and there was
 * no row that said what an author was owed. Both facts moved. `order_shares`
 * (migration 20260926010000) is that row — written by the database when an
 * order becomes paid — and the author terms G set on 14.10 are a share, not a
 * price: 90 % from the author's own channels, 50 % from the platform's. An
 * author who is promised a share and cannot see it is being asked to trust,
 * which is exactly what the terms were meant to replace.
 *
 * WHAT CROSSES THIS BOUNDARY. The author's own share rows, the order's date,
 * course and the `?ref` tag it came by. Never the buyer: no name, email, phone
 * or customer id is read here — the same line `authorAudience.ts` draws for
 * learners. «Хто купив» is the platform's to know; «скільки і звідки» is the
 * author's.
 *
 * WHERE THE SOURCE COMES FROM. An order whose `ref` is one of the author's own
 * `author_links` is theirs (`order_shares.source = 'author'`); everything else
 * is the platform's. The tag is first-touch for 90 days (`src/lib/referral`),
 * and platform ads carry UTM, not `ref`, so a person who saw an ad first and
 * bought after the author's reel is still the author's.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { normalizeRef } from "@/lib/referral/ref";
import { slugify } from "@/lms-core/drafts";

export type LedgerStatus = "accrued" | "split_at_source" | "paid_out" | "reversed" | "clawback";
export type LedgerSource = "author" | "platform";

export type LedgerAuthor = { id: string; slug: string; name: string };

export type LedgerRow = {
  orderRef: string;
  /** ISO. When the order was created — the buyer's moment, not the payout's. */
  createdAt: string;
  courseTitle: string | null;
  baseAmount: number;
  amount: number;
  sharePct: number;
  currency: string;
  status: LedgerStatus;
  source: LedgerSource;
  ref: string | null;
};

export type LedgerLink = {
  tag: string;
  label: string;
  channel: string | null;
  targetPath: string;
  createdAt: string;
};

export type LedgerTotals = {
  /** Everything buyers paid for the author's work, before refunds. */
  gross: number;
  /** The author's part of the orders that still stand. */
  share: number;
  /** Already the author's: split at the gateway, or paid out by hand. */
  received: number;
  /** Accrued and still to be paid out by hand. */
  awaiting: number;
  orders: number;
  ownOrders: number;
  platformOrders: number;
  refunds: number;
  /** The author's part of the refunded orders, as a positive number. */
  refunded: number;
};

export type LedgerSourceLine = {
  /** The link's tag, or `platform` for everything the platform brought. */
  key: string;
  label: string;
  source: LedgerSource;
  orders: number;
  share: number;
};

const STANDING: ReadonlySet<LedgerStatus> = new Set(["accrued", "split_at_source", "paid_out"]);
const RECEIVED: ReadonlySet<LedgerStatus> = new Set(["split_at_source", "paid_out"]);

/** Kopeck-exact sums: money is never added as floats left to drift. */
function addMoney(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

export function summarizeLedger(rows: readonly LedgerRow[]): LedgerTotals {
  const totals: LedgerTotals = {
    gross: 0,
    share: 0,
    received: 0,
    awaiting: 0,
    orders: 0,
    ownOrders: 0,
    platformOrders: 0,
    refunds: 0,
    refunded: 0,
  };
  for (const row of rows) {
    totals.gross = addMoney(totals.gross, row.baseAmount);
    totals.orders += 1;
    if (row.source === "author") totals.ownOrders += 1;
    else totals.platformOrders += 1;

    if (STANDING.has(row.status)) {
      totals.share = addMoney(totals.share, row.amount);
      if (RECEIVED.has(row.status)) totals.received = addMoney(totals.received, row.amount);
      else totals.awaiting = addMoney(totals.awaiting, row.amount);
    } else {
      totals.refunds += 1;
      totals.refunded = addMoney(totals.refunded, row.amount);
    }
  }
  return totals;
}

/**
 * One line per link that sold, plus one for the platform, ordered by share.
 *
 * A tag that sold but is no longer in the author's list (archived, or an
 * author tag from before the list existed) still gets its own line under the
 * tag itself: money is never folded into «інше» just because its label is gone.
 */
export function ledgerBySource(rows: readonly LedgerRow[], links: readonly LedgerLink[]): LedgerSourceLine[] {
  const labels = new Map(links.map((link) => [link.tag, link.label]));
  const lines = new Map<string, LedgerSourceLine>();
  for (const row of rows) {
    if (!STANDING.has(row.status)) continue;
    const key = row.source === "author" && row.ref ? row.ref : "platform";
    const line = lines.get(key) ?? {
      key,
      label: key === "platform" ? "CenterWay" : (labels.get(key) ?? key),
      source: key === "platform" ? "platform" : "author",
      orders: 0,
      share: 0,
    };
    line.orders += 1;
    line.share = addMoney(line.share, row.amount);
    lines.set(key, line);
  }
  return [...lines.values()].sort((a, b) => b.share - a.share || a.label.localeCompare(b.label, "uk"));
}

/** Orders per tag, for the link list — standing orders only, refunds do not count as a sale. */
export function ordersByTag(rows: readonly LedgerRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!STANDING.has(row.status) || row.source !== "author" || !row.ref) continue;
    counts.set(row.ref, (counts.get(row.ref) ?? 0) + 1);
  }
  return counts;
}

/**
 * A tag for a new link: the author's slug, the channel, the post — readable
 * aloud, inside the `?ref` shape, and unique among tags already taken.
 */
export function proposeLinkTag(
  authorSlug: string,
  channel: string | null,
  label: string,
  taken: Iterable<string>,
): string {
  const head = slugify(authorSlug).slice(0, 20);
  const middle = channel ? slugify(channel).slice(0, 12) : "";
  const tail = slugify(label).slice(0, 24);
  const base = [head, middle, tail].filter((part) => part && part !== "item").join("-") || head;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** A site path the link may point at: absolute, no host, no whitespace, short. */
export function normalizeTargetPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  return /^\/(?!\/)[^\s]{0,200}$/.test(path) ? path : null;
}

/** The CSV a bookkeeper opens: one row per order, semicolon-separated as Ukrainian Excel expects. */
export function ledgerCsv(rows: readonly LedgerRow[]): string {
  const STATUS_WORDS: Record<LedgerStatus, string> = {
    accrued: "нараховано",
    split_at_source: "розділено при оплаті",
    paid_out: "виплачено",
    reversed: "повернення до виплати",
    clawback: "повернення після виплати",
  };
  const cell = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const money = (value: number) => value.toFixed(2).replace(".", ",");
  const header = [
    "Дата",
    "Замовлення",
    "Курс",
    "Сума замовлення",
    "Відсоток",
    "Ваша частка",
    "Валюта",
    "Стан",
    "Джерело",
  ];
  const lines = rows.map((row) =>
    [
      row.createdAt.slice(0, 10),
      row.orderRef,
      row.courseTitle,
      money(row.baseAmount),
      String(row.sharePct).replace(".", ","),
      money(STANDING.has(row.status) ? row.amount : -row.amount),
      row.currency,
      STATUS_WORDS[row.status],
      row.source === "author" ? (row.ref ?? "ваше посилання") : "CenterWay",
    ]
      .map(cell)
      .join(";"),
  );
  return `﻿${[header.join(";"), ...lines].join("\r\n")}\r\n`;
}

const LEDGER_PAGE = 1000;
/* An `in (...)` list travels in the URL; 300 refs keep it well inside limits. */
const LEDGER_IN_CHUNK = 300;

/** The caller's own author row, or null — admins without a byline have no ledger of their own. */
export async function findLedgerAuthor(authUserId: string): Promise<LedgerAuthor | null> {
  const db = adminClient();
  const { data } = await db
    .from("lms_authors")
    .select("id, slug, name")
    .eq("auth_user_id", authUserId)
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, slug: data.slug, name: data.name } : null;
}

/**
 * The author's share rows since `sinceIso` (all time when null), newest first.
 *
 * Three reads, joined here rather than in a view: the share rows, the orders
 * they belong to (date, ref), and the courses' titles. Throws on a failed read
 * — an unread ledger must never render as an empty one.
 */
export async function readLedgerRows(authorId: string, sinceIso: string | null): Promise<LedgerRow[]> {
  const db = adminClient();
  /* PAGED, because PostgREST caps one response: an author past that cap would
     see totals and a CSV that silently stop at the first page. */
  const shares: Array<{
    order_ref: string;
    share_pct: number | string;
    base_amount: number | string;
    amount: number | string;
    currency: string;
    status: string;
    source: string | null;
    ref: string | null;
  }> = [];
  for (let from = 0; ; from += LEDGER_PAGE) {
    const { data, error } = await db
      .from("order_shares")
      .select("order_ref, share_pct, base_amount, amount, currency, status, source, ref")
      .eq("author_id", authorId)
      .order("order_ref", { ascending: true })
      .range(from, from + LEDGER_PAGE - 1);
    if (error) throw new Error(`ledger_shares_read_failed: ${error.message}`);
    shares.push(...(data ?? []));
    if (!data || data.length < LEDGER_PAGE) break;
  }
  if (shares.length === 0) return [];

  const refs = shares.map((share) => share.order_ref);
  const orders: Array<{ order_ref: string; created_at: string; experience_id: string | null }> = [];
  for (let i = 0; i < refs.length; i += LEDGER_IN_CHUNK) {
    const { data, error: ordersError } = await db
      .from("orders")
      .select("order_ref, created_at, experience_id")
      .in("order_ref", refs.slice(i, i + LEDGER_IN_CHUNK));
    if (ordersError) throw new Error(`ledger_orders_read_failed: ${ordersError.message}`);
    orders.push(...(data ?? []));
  }
  const orderBy = new Map(orders.map((order) => [order.order_ref, order]));

  const experienceIds = [...new Set(orders.flatMap((order) => (order.experience_id ? [order.experience_id] : [])))];
  const titles = new Map<string, string>();
  if (experienceIds.length > 0) {
    const { data: experiences } = await db.from("experiences").select("id, title").in("id", experienceIds);
    for (const experience of experiences ?? []) if (experience.title) titles.set(experience.id, experience.title);
  }

  const rows: LedgerRow[] = [];
  for (const share of shares) {
    const order = orderBy.get(share.order_ref);
    const createdAt = order?.created_at ?? "";
    if (sinceIso && createdAt < sinceIso) continue;
    rows.push({
      orderRef: share.order_ref,
      createdAt,
      courseTitle: order?.experience_id ? (titles.get(order.experience_id) ?? null) : null,
      baseAmount: Number(share.base_amount),
      amount: Number(share.amount),
      sharePct: Number(share.share_pct),
      currency: share.currency,
      status: share.status as LedgerStatus,
      source: share.source === "author" ? "author" : "platform",
      ref: share.ref,
    });
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listLedgerLinks(authorId: string): Promise<LedgerLink[]> {
  const db = adminClient();
  const { data, error } = await db
    .from("author_links")
    .select("tag, label, channel, target_path, created_at")
    .eq("author_id", authorId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`ledger_links_read_failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    tag: row.tag,
    label: row.label,
    channel: row.channel,
    targetPath: row.target_path,
    createdAt: row.created_at,
  }));
}

export class LedgerLinkError extends Error {}

/** Creates one link for the author. The tag is derived, never typed: a typed tag is a typo waiting to lose a sale. */
export async function createLedgerLink(
  author: LedgerAuthor,
  input: { label: unknown; channel?: unknown; targetPath?: unknown },
): Promise<LedgerLink> {
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (label.length < 1 || label.length > 120) throw new LedgerLinkError("link_label_invalid");
  const channel = typeof input.channel === "string" && input.channel.trim() ? input.channel.trim().slice(0, 40) : null;
  const targetPath =
    input.targetPath === undefined || input.targetPath === null || input.targetPath === ""
      ? `/expert/${author.slug}`
      : normalizeTargetPath(input.targetPath);
  if (!targetPath) throw new LedgerLinkError("link_target_invalid");

  const db = adminClient();
  const draft = proposeLinkTag(author.slug, channel, label, []);
  const { data: clashes, error: readError } = await db.from("author_links").select("tag").ilike("tag", `${draft}%`);
  if (readError) throw new Error(`ledger_links_read_failed: ${readError.message}`);
  const tag = proposeLinkTag(
    author.slug,
    channel,
    label,
    (clashes ?? []).map((row) => row.tag),
  );
  if (normalizeRef(tag) !== tag) throw new LedgerLinkError("link_tag_invalid");

  const { data, error } = await db
    .from("author_links")
    .insert({ tag, author_id: author.id, label, channel, target_path: targetPath })
    .select("tag, label, channel, target_path, created_at")
    .single();
  if (error || !data) throw new Error(`ledger_link_write_failed: ${error?.message ?? "no_row"}`);
  return {
    tag: data.tag,
    label: data.label,
    channel: data.channel,
    targetPath: data.target_path,
    createdAt: data.created_at,
  };
}
