import { describe, expect, it } from "vitest";

import {
  ledgerBySource,
  ledgerCsv,
  normalizeTargetPath,
  ordersByTag,
  proposeLinkTag,
  summarizeLedger,
  type LedgerRow,
} from "./authorLedger";

const row = (over: Partial<LedgerRow>): LedgerRow => ({
  orderRef: "cw-1",
  createdAt: "2026-10-10T09:00:00Z",
  courseTitle: "Шлях 21",
  baseAmount: 1000,
  amount: 900,
  sharePct: 90,
  currency: "UAH",
  status: "accrued",
  source: "author",
  ref: "anna-ig-reel",
  ...over,
});

const rows: LedgerRow[] = [
  row({ orderRef: "cw-1" }),
  row({ orderRef: "cw-2", status: "split_at_source", amount: 900.1 }),
  row({ orderRef: "cw-3", source: "platform", ref: null, amount: 500, sharePct: 50, status: "paid_out" }),
  row({ orderRef: "cw-4", status: "reversed" }),
];

describe("summarizeLedger", () => {
  it("separates what stands, what is already the author's, and what was refunded", () => {
    expect(summarizeLedger(rows)).toEqual({
      gross: 4000,
      share: 2300.1,
      received: 1400.1,
      awaiting: 900,
      orders: 4,
      ownOrders: 3,
      platformOrders: 1,
      refunds: 1,
      refunded: 900,
    });
  });
});

describe("ledgerBySource / ordersByTag", () => {
  const links = [{ tag: "anna-ig-reel", label: "Рілс про сон", channel: "instagram", targetPath: "/", createdAt: "" }];

  it("names each link by its label, keeps the platform apart, and skips refunds", () => {
    expect(ledgerBySource(rows, links)).toEqual([
      { key: "anna-ig-reel", label: "Рілс про сон", source: "author", orders: 2, share: 1800.1 },
      { key: "platform", label: "CenterWay", source: "platform", orders: 1, share: 500 },
    ]);
    expect(ordersByTag(rows)).toEqual(new Map([["anna-ig-reel", 2]]));
  });

  it("keeps a tag that is no longer listed under the tag itself", () => {
    expect(ledgerBySource([row({ ref: "old-tag" })], [])[0]).toMatchObject({ key: "old-tag", label: "old-tag" });
  });
});

describe("proposeLinkTag", () => {
  it("builds a readable tag inside the ?ref shape and avoids taken ones", () => {
    const tag = proposeLinkTag("anna", "instagram", "Рілс про сон", []);
    expect(tag).toMatch(/^[a-z0-9][a-z0-9_-]{0,63}$/);
    expect(tag.startsWith("anna-instagram-")).toBe(true);
    expect(proposeLinkTag("anna", "instagram", "Рілс про сон", [tag])).toBe(`${tag}-2`);
  });
});

describe("normalizeTargetPath", () => {
  it("accepts site paths only", () => {
    expect(normalizeTargetPath(" /expert/anna ")).toBe("/expert/anna");
    expect(normalizeTargetPath("//evil.example")).toBeNull();
    expect(normalizeTargetPath("https://evil.example")).toBeNull();
    expect(normalizeTargetPath("/with space")).toBeNull();
    expect(normalizeTargetPath(42)).toBeNull();
  });
});

describe("ledgerCsv", () => {
  it("writes a semicolon file with a BOM, comma decimals, and refunds as negatives", () => {
    const csv = ledgerCsv([row({ status: "reversed", courseTitle: 'Курс "А; Б"' })]);
    expect(csv.startsWith("﻿Дата;")).toBe(true);
    expect(csv).toContain('2026-10-10;cw-1;"Курс ""А; Б""";1000,00;90;-900,00;UAH;повернення до виплати;anna-ig-reel');
  });
});
