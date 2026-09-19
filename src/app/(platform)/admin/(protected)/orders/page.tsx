"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { ReconcileModal } from "@/components/admin/modals/ReconcileModal";
import { useToast } from "@/components/ToastProvider";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { ORDER_STATUS_BADGE_CLASS } from "@/lib/admin/adminStatusStyles";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { FULFILMENT_STATUSES, type FulfilmentStatus } from "@/lib/admin/fulfilmentStatus";
import { Icon } from "@/components/Icon";
import pageStyles from "@/components/admin/AdminPage.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";

interface Order {
  id: string;
  order_ref: string;
  product_code: string;
  amount: number | null;
  currency: string | null;
  status: string;
  /** Set only for orders a person carries out (consultation, package, parcel). */
  fulfilment_status: FulfilmentStatus | null;
  customer_id: string | null;
  created_at: string;
  customers: {
    id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
  } | null;
}

interface IssuedLandingOffer {
  product: "irem";
  offerId: string;
  offerToken: string;
  recipientKey: string;
  amount: number;
  oldAmount: number;
  currency: string;
  status: "draft";
  issuedAt: string | null;
  expiresAt: string | null;
  discountPercent: number;
  landingUrl: string;
  batchId: string | null;
}

interface CsvImportedOfferEntry {
  recipientKey: string;
  channel: string | null;
  campaign: string | null;
  note: string | null;
}

interface IssuedLandingOfferSummary {
  totalRequested: number;
  totalIssued: number;
  totalDeduped: number;
}

interface IssuedLandingOfferResponse {
  batchId: string | null;
  offers: IssuedLandingOffer[];
  summary: IssuedLandingOfferSummary | null;
}

type PersonalOfferLabels = {
  title: string;
  subtitle: string;
  modeSingle: string;
  modeBulk: string;
  modeCsv: string;
  modeSingleHint: string;
  modeBulkHint: string;
  modeCsvHint: string;
  settingsTitle: string;
  settingsSubtitle: string;
  productLabel: string;
  productValue: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  bulkLabel: string;
  bulkPlaceholder: string;
  csvLabel: string;
  csvHelper: string;
  csvReplace: string;
  csvLoaded: string;
  csvEmpty: string;
  previewTitle: string;
  previewReady: string;
  previewRecipients: string;
  previewDeduped: string;
  previewChannels: string;
  previewMode: string;
  channelLabel: string;
  channelPlaceholder: string;
  campaignLabel: string;
  campaignPlaceholder: string;
  noteLabel: string;
  notePlaceholder: string;
  helper: string;
  submit: string;
  submitting: string;
  clear: string;
  copyAll: string;
  downloadCsv: string;
  copy: string;
  copied: string;
  open: string;
  latest: string;
  latestBatch: string;
  batchIdLabel: string;
  price: string;
  validWindow: string;
  recipientRequired: string;
  issueSuccess: string;
  issueBatchSuccess: string;
  copySuccess: string;
  copyAllSuccess: string;
  downloadCsvSuccess: string;
  issueError: string;
  csvError: string;
  networkError: string;
  unknown: string;
};

function ResendAccessButton({
  orderRef,
  labels,
}: {
  orderRef: string;
  labels: {
    copied: string;
    copiedUnpaid: string;
    copyLink: string;
    createError: string;
    networkError: string;
    unknown: string;
  };
}) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await authorizedFetch("/api/admin/orders/access-link", {
        method: "POST",
        body: JSON.stringify({ order_ref: orderRef }),
      });
      const data = await res.json();
      if (data.ok && data.link) {
        /* The server hands back a whole URL and it is pasted verbatim.
                   The old code built one here out of `window.location.origin`
                   and a guessed path — which is how it came to point at
                   `/pay/return?token=…`, a route that reads no token and
                   redirected the customer to the payment-failed page. The admin
                   also runs on a different host from the course, so an origin
                   taken from the operator's address bar was wrong twice. */
        await navigator.clipboard.writeText(data.link);
        setCopied(true);
        toast.success(data.paid === false ? labels.copiedUnpaid : labels.copied);
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error(`${labels.createError}: ${data.error || labels.unknown}`);
      }
    } catch {
      toast.error(labels.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handle}
      title={copied ? labels.copied : labels.copyLink}
      aria-label={copied ? labels.copied : labels.copyLink}
      className={`cw-icon-btn ${lists.rowAction}`}
    >
      <InteractionInkIcon>
        {copied ? <Icon className="cw-status-success-text" name="check" size={16} /> : <Icon name="link" size={16} />}
      </InteractionInkIcon>
    </button>
  );
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      insideQuotes = !insideQuotes;
      continue;
    }
    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvEntries(fileText: string): CsvImportedOfferEntry[] {
  const normalizedText = fileText.replace(/^\uFEFF/, "");
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [firstLine] = lines;
  if (!firstLine) {
    return [];
  }

  const firstCells = parseCsvLine(firstLine);
  const firstRow = firstCells.map((value) => value.toLowerCase());
  const hasHeader = firstRow.includes("recipient_key") || firstRow.includes("recipientkey");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const headerIndex = new Map<string, number>();

  if (hasHeader) {
    firstCells.forEach((value, index) => {
      headerIndex.set(value.trim().toLowerCase(), index);
    });
  }

  return dataLines
    .map((line) => parseCsvLine(line))
    .map((columns) => {
      const readColumn = (name: string, fallbackIndex: number) => {
        const index = headerIndex.get(name);
        const value = columns[index ?? fallbackIndex] ?? "";
        return value.trim() || null;
      };

      return {
        recipientKey: readColumn("recipient_key", 0) ?? readColumn("recipientkey", 0) ?? "",
        channel: readColumn("channel", 1),
        campaign: readColumn("campaign", 2),
        note: readColumn("note", 3),
      };
    })
    .filter((entry) => entry.recipientKey);
}

function PersonalOfferPanel({ labels }: { labels: PersonalOfferLabels }) {
  const toast = useToast();
  const MODE_TABS = [
    { key: "single", label: labels.modeSingle },
    { key: "bulk", label: labels.modeBulk },
    { key: "csv", label: labels.modeCsv },
  ];
  const [activeMode, setActiveMode] = useState("single");
  const [recipientKey, setRecipientKey] = useState("");
  const [bulkRecipients, setBulkRecipients] = useState("");
  const [channel, setChannel] = useState("telegram");
  const [campaign, setCampaign] = useState("launch_may_2026");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvEntries, setCsvEntries] = useState<CsvImportedOfferEntry[]>([]);
  const [issuedOffers, setIssuedOffers] = useState<IssuedLandingOffer[]>([]);
  const [issuedSummary, setIssuedSummary] = useState<IssuedLandingOfferSummary | null>(null);
  const [issuedBatchId, setIssuedBatchId] = useState<string | null>(null);

  const pastedRecipients = bulkRecipients
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const previewEntries: CsvImportedOfferEntry[] =
    activeMode === "single"
      ? recipientKey.trim()
        ? [
            {
              recipientKey: recipientKey.trim(),
              channel: channel.trim() || null,
              campaign: campaign.trim() || null,
              note: note.trim() || null,
            },
          ]
        : []
      : activeMode === "bulk"
        ? pastedRecipients.map((pastedRecipient) => ({
            recipientKey: pastedRecipient,
            channel: channel.trim() || null,
            campaign: campaign.trim() || null,
            note: note.trim() || null,
          }))
        : csvEntries.map((entry) => ({
            recipientKey: entry.recipientKey.trim(),
            channel: entry.channel ?? (channel.trim() || null),
            campaign: entry.campaign ?? (campaign.trim() || null),
            note: entry.note ?? (note.trim() || null),
          }));

  const seenRecipients = new Set<string>();
  const dedupedRecipients: string[] = [];
  for (const entry of previewEntries) {
    if (!entry.recipientKey) continue;
    if (seenRecipients.has(entry.recipientKey)) {
      dedupedRecipients.push(entry.recipientKey);
      continue;
    }
    seenRecipients.add(entry.recipientKey);
  }

  const previewRecipientCount = seenRecipients.size;
  const previewChannels = Array.from(new Set(previewEntries.map((entry) => entry.channel).filter(Boolean)));
  const currentModeLabel =
    activeMode === "single" ? labels.modeSingle : activeMode === "bulk" ? labels.modeBulk : labels.modeCsv;

  const copyLandingUrl = async (landingUrl: string) => {
    await navigator.clipboard.writeText(landingUrl);
    setCopiedUrl(landingUrl);
    toast.success(labels.copySuccess);
    window.setTimeout(() => setCopiedUrl((current) => (current === landingUrl ? null : current)), 2000);
  };

  const copyAllLandingUrls = async (offers: IssuedLandingOffer[]) => {
    if (offers.length === 0) return;
    await navigator.clipboard.writeText(offers.map((offer) => offer.landingUrl).join("\n"));
    toast.success(labels.copyAllSuccess);
  };

  const downloadIssuedCsv = () => {
    if (issuedOffers.length === 0) return;

    const rows = [
      [
        "recipient_key",
        "channel",
        "campaign",
        "note",
        "offerToken",
        "landingPromoUrl",
        "batchId",
        "status",
        "price",
        "currency",
      ],
      ...issuedOffers.map((offer) => {
        const sourceEntry = previewEntries.find((entry) => entry.recipientKey === offer.recipientKey);
        return [
          offer.recipientKey,
          sourceEntry?.channel ?? "",
          sourceEntry?.campaign ?? "",
          sourceEntry?.note ?? "",
          offer.offerToken,
          offer.landingUrl,
          offer.batchId ?? issuedBatchId ?? "",
          offer.status,
          String(offer.amount),
          offer.currency,
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const safe = String(value ?? "");
            return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `irem-promo-links-${issuedBatchId ?? "batch"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(labels.downloadCsvSuccess);
  };

  const clearAllInputs = () => {
    setRecipientKey("");
    setBulkRecipients("");
    setCsvEntries([]);
    setCsvFileName(null);
    setNote("");
    setIssuedOffers([]);
    setIssuedSummary(null);
    setIssuedBatchId(null);
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileText = await file.text();
      const parsedEntries = parseCsvEntries(fileText);
      setCsvEntries(parsedEntries);
      setCsvFileName(file.name);
      if (parsedEntries.length === 0) {
        toast.info(labels.csvEmpty);
      }
    } catch {
      toast.error(labels.csvError);
    } finally {
      event.target.value = "";
    }
  };

  const handleIssue = async () => {
    if (loading) return;
    if (previewEntries.length === 0) {
      toast.error(labels.recipientRequired);
      return;
    }

    setLoading(true);
    try {
      const res = await authorizedFetch("/api/admin/landing-offers", {
        method: "POST",
        body: JSON.stringify({
          product: "irem",
          entries: previewEntries.map((entry) => ({
            recipient_key: entry.recipientKey,
            channel: entry.channel,
            campaign: entry.campaign,
            note: entry.note,
          })),
          channel: channel.trim() || null,
          campaign: campaign.trim() || null,
          note: note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !Array.isArray(json?.offers)) {
        toast.error(`${labels.issueError}: ${json?.error || labels.unknown}`);
        return;
      }

      const response: IssuedLandingOfferResponse = {
        batchId: typeof json.batchId === "string" ? json.batchId : null,
        offers: json.offers as IssuedLandingOffer[],
        summary: (json.summary ?? null) as IssuedLandingOfferSummary | null,
      };
      setIssuedOffers(response.offers);
      setIssuedSummary(response.summary);
      setIssuedBatchId(response.batchId);

      const [soleOffer] = response.offers;
      if (response.offers.length === 1 && soleOffer) {
        await copyLandingUrl(soleOffer.landingUrl);
        toast.success(labels.issueSuccess);
      } else {
        await copyAllLandingUrls(response.offers);
        toast.success(labels.issueBatchSuccess);
      }
    } catch {
      toast.error(labels.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${surfaces.plate} ${controls.formStack}`}>
      <div className={controls.formHead}>
        <h3 className={controls.disclosureTitle}>{labels.title}</h3>
        <p className={controls.formNote}>{labels.subtitle}</p>
      </div>

      <AdminTabs items={MODE_TABS} activeKey={activeMode} onChange={setActiveMode} />

      <div className={lists.item}>
        <label className={controls.field}>
          <span className={controls.fieldCaption}>{labels.productLabel}</span>
          <div className={controls.inputStatic}>{labels.productValue}</div>
        </label>
        {activeMode === "single" ? (
          <div className={controls.fieldStack}>
            <p className={controls.hint}>{labels.modeSingleHint}</p>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{labels.recipientLabel}</span>
              <input
                type="text"
                value={recipientKey}
                onChange={(event) => setRecipientKey(event.target.value)}
                placeholder={labels.recipientPlaceholder}
                className={controls.input}
              />
            </label>
          </div>
        ) : null}
        {activeMode === "bulk" ? (
          <div className={controls.fieldStack}>
            <p className={controls.hint}>{labels.modeBulkHint}</p>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{labels.bulkLabel}</span>
              <textarea
                value={bulkRecipients}
                onChange={(event) => setBulkRecipients(event.target.value)}
                placeholder={labels.bulkPlaceholder}
                className={controls.textarea}
              />
            </label>
          </div>
        ) : null}
        {activeMode === "csv" ? (
          <div className={controls.fieldStack}>
            <p className={controls.hint}>{labels.modeCsvHint}</p>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{labels.csvLabel}</span>
              <div className={controls.fileRow}>
                <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className={controls.input} />
                {csvFileName ? (
                  <span className={controls.hint}>
                    {labels.csvLoaded}: {csvFileName}
                  </span>
                ) : null}
              </div>
              <p className={controls.hint}>{labels.csvHelper}</p>
            </label>
          </div>
        ) : null}
      </div>

      <div className={lists.item}>
        <div className={controls.formHead}>
          <p className={lists.itemTitle}>{labels.settingsTitle}</p>
          <p className={controls.hint}>{labels.settingsSubtitle}</p>
        </div>
        <div className={controls.fieldsTwo}>
          <label className={controls.field}>
            <span className={controls.fieldCaption}>{labels.channelLabel}</span>
            <input
              type="text"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              placeholder={labels.channelPlaceholder}
              className={controls.input}
            />
          </label>
          <label className={controls.field}>
            <span className={controls.fieldCaption}>{labels.campaignLabel}</span>
            <input
              type="text"
              value={campaign}
              onChange={(event) => setCampaign(event.target.value)}
              placeholder={labels.campaignPlaceholder}
              className={controls.input}
            />
          </label>
        </div>
      </div>

      <label className={controls.field}>
        <span className={controls.fieldCaption}>{labels.noteLabel}</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={labels.notePlaceholder}
          className={controls.textareaShort}
        />
      </label>

      <div className={lists.item}>
        <p className={lists.itemTitle}>{labels.previewTitle}</p>
        <p className={controls.hint}>{labels.previewReady}</p>
        <div className={lists.itemMeta}>
          <span>
            {labels.previewMode}: {currentModeLabel}
          </span>
          <span>
            {labels.previewRecipients}: {previewRecipientCount}
          </span>
          <span>
            {labels.previewDeduped}: {dedupedRecipients.length}
          </span>
          <span>
            {labels.previewChannels}: {previewChannels.length > 0 ? previewChannels.join(", ") : "—"}
          </span>
        </div>
        {csvEntries.length > 0 ? (
          <p className={controls.hint}>
            {labels.csvLoaded}: {csvFileName}
          </p>
        ) : null}
      </div>

      <div className={controls.formFooter}>
        <p className={controls.hint}>{labels.helper}</p>
        <div className={controls.actionPair}>
          <button type="button" onClick={clearAllInputs} className={`${controls.actionFill} cw-surface-2`}>
            {labels.clear}
          </button>
          <button
            type="button"
            onClick={handleIssue}
            disabled={loading}
            className={`${controls.actionFill} cw-surface-2`}
          >
            {loading ? labels.submitting : labels.submit}
          </button>
        </div>
      </div>

      {issuedOffers.length > 0 && (
        <div className={lists.item}>
          <div className={controls.formHead}>
            <p className={lists.itemTitle}>{issuedOffers.length > 1 ? labels.latestBatch : labels.latest}</p>
            {issuedSummary ? (
              <div className={lists.itemMeta}>
                <span>
                  {labels.previewRecipients}: {issuedSummary.totalIssued}
                </span>
                <span>
                  {labels.previewDeduped}: {issuedSummary.totalDeduped}
                </span>
                {issuedBatchId ? (
                  <span>
                    {labels.batchIdLabel}: {issuedBatchId}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          {issuedOffers.length > 1 ? (
            <div className={controls.iconActions}>
              <button
                type="button"
                onClick={() => copyAllLandingUrls(issuedOffers)}
                className="cw-icon-btn"
                title={labels.copyAll}
                aria-label={labels.copyAll}
              >
                <InteractionInkIcon>
                  <Icon name="copy" size={16} />
                </InteractionInkIcon>
              </button>
              <button
                type="button"
                onClick={downloadIssuedCsv}
                className="cw-icon-btn"
                title={labels.downloadCsv}
                aria-label={labels.downloadCsv}
              >
                <InteractionInkIcon>
                  <Icon name="import" size={16} />
                </InteractionInkIcon>
              </button>
            </div>
          ) : null}
          <div className={lists.issued}>
            {issuedOffers.slice(0, 24).map((offer) => (
              <div key={offer.offerToken} className={lists.issuedEntry}>
                <div className={lists.issuedHead}>
                  <p className={lists.issuedUrl}>{offer.landingUrl}</p>
                  <div className={controls.inlineActions}>
                    <button
                      type="button"
                      onClick={() => copyLandingUrl(offer.landingUrl)}
                      className="cw-icon-btn"
                      title={copiedUrl === offer.landingUrl ? labels.copied : labels.copy}
                      aria-label={copiedUrl === offer.landingUrl ? labels.copied : labels.copy}
                    >
                      <InteractionInkIcon>
                        {copiedUrl === offer.landingUrl ? (
                          <Icon className="cw-status-success-text" name="check" size={16} />
                        ) : (
                          <Icon name="copy" size={16} />
                        )}
                      </InteractionInkIcon>
                    </button>
                    <a
                      href={offer.landingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cw-icon-btn"
                      title={labels.open}
                      aria-label={labels.open}
                    >
                      <InteractionInkIcon>
                        <Icon name="export" size={16} />
                      </InteractionInkIcon>
                    </a>
                  </div>
                </div>
                <div className={lists.itemMetaSpaced}>
                  <span>
                    {labels.price}: {offer.amount.toLocaleString("uk-UA")} {offer.currency}
                  </span>
                  <span>{labels.validWindow}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { lang, t } = useI18n();
  const isUk = lang === "uk";
  const locale = getAdminLocale(lang);
  const statusLabel: Record<string, string> = {
    paid: t("orders_status_paid"),
    created: t("orders_status_created"),
    pending: t("orders_status_pending"),
    refunded: t("orders_status_refunded"),
  };
  const fulfilmentLabel: Record<FulfilmentStatus, string> = {
    pending: t("orders_fulfilment_pending"),
    scheduled: t("orders_fulfilment_scheduled"),
    done: t("orders_fulfilment_done"),
    cancelled: t("orders_fulfilment_cancelled"),
  };
  const STATUS_TABS = [
    { key: "", label: t("orders_tab_all") },
    { key: "paid", label: t("orders_tab_paid") },
    { key: "created", label: t("orders_tab_waiting") },
    { key: "refunded", label: t("orders_tab_refunds") },
    { key: "offers", label: t("orders_tab_offers") },
  ];

  const copyLabels = {
    copied: t("orders_copy_copied"),
    copiedUnpaid: t("orders_copy_copied_unpaid"),
    copyLink: t("orders_copy_link"),
    createError: t("orders_copy_error"),
    networkError: t("orders_network_error"),
    unknown: t("common_unknown"),
  };

  const reconcileLabels = {
    title: t("orders_reconcile_title"),
    order: t("orders_reconcile_order"),
    product: t("orders_reconcile_product"),
    amount: t("orders_reconcile_amount"),
    status: t("orders_reconcile_status"),
    notePlaceholder: t("orders_reconcile_note"),
    confirmPaid: t("orders_reconcile_confirm_paid"),
    refund: t("orders_reconcile_refund"),
    cancel: t("orders_reconcile_cancel"),
  };

  const personalOfferLabels: PersonalOfferLabels = {
    title: t("orders_offer_title"),
    subtitle: t("orders_offer_subtitle"),
    modeSingle: t("orders_offer_mode_single"),
    modeBulk: t("orders_offer_mode_bulk"),
    modeCsv: t("orders_offer_mode_csv"),
    modeSingleHint: t("orders_offer_mode_single_hint"),
    modeBulkHint: t("orders_offer_mode_bulk_hint"),
    modeCsvHint: t("orders_offer_mode_csv_hint"),
    settingsTitle: t("orders_offer_settings_title"),
    settingsSubtitle: t("orders_offer_settings_subtitle"),
    productLabel: t("orders_offer_product_label"),
    productValue: t("orders_offer_product_value"),
    recipientLabel: t("orders_offer_recipient_label"),
    recipientPlaceholder: t("orders_offer_recipient_placeholder"),
    bulkLabel: t("orders_offer_bulk_label"),
    bulkPlaceholder: t("orders_offer_bulk_placeholder"),
    csvLabel: t("orders_offer_csv_label"),
    csvHelper: t("orders_offer_csv_helper"),
    csvReplace: t("orders_offer_csv_replace"),
    csvLoaded: t("orders_offer_csv_loaded"),
    csvEmpty: t("orders_offer_csv_empty"),
    previewTitle: t("orders_offer_preview_title"),
    previewReady: t("orders_offer_preview_ready"),
    previewMode: t("orders_offer_preview_mode"),
    previewRecipients: t("orders_offer_preview_recipients"),
    previewDeduped: t("orders_offer_preview_deduped"),
    previewChannels: t("orders_offer_preview_channels"),
    channelLabel: t("orders_offer_channel_label"),
    channelPlaceholder: t("orders_offer_channel_placeholder"),
    campaignLabel: t("orders_offer_campaign_label"),
    campaignPlaceholder: t("orders_offer_campaign_placeholder"),
    noteLabel: t("orders_offer_note_label"),
    notePlaceholder: t("orders_offer_note_placeholder"),
    helper: t("orders_offer_helper"),
    submit: t("orders_offer_submit"),
    submitting: t("orders_offer_submitting"),
    clear: t("orders_offer_clear"),
    copyAll: t("orders_offer_copy_all"),
    downloadCsv: t("orders_offer_download_csv"),
    copy: t("orders_offer_copy"),
    copied: t("orders_offer_copied"),
    open: t("orders_offer_open"),
    latest: t("orders_offer_latest"),
    latestBatch: t("orders_offer_latest_batch"),
    batchIdLabel: t("orders_offer_batch_id_label"),
    price: t("orders_offer_price"),
    validWindow: t("orders_offer_valid_window"),
    recipientRequired: t("orders_offer_recipient_required"),
    issueSuccess: t("orders_offer_issue_success"),
    issueBatchSuccess: t("orders_offer_issue_batch_success"),
    copySuccess: t("orders_offer_copy_success"),
    copyAllSuccess: t("orders_offer_copy_all_success"),
    downloadCsvSuccess: t("orders_offer_download_csv_success"),
    issueError: t("orders_offer_issue_error"),
    csvError: t("orders_offer_csv_error"),
    networkError: t("orders_network_error"),
    unknown: t("common_unknown"),
  };

  const [q, setQ] = useState("");
  const [debouncedQ, setDQ] = useState("");
  const [activeStatus, setStatus] = useState("");
  const [data, setData] = useState<Order[]>([]);
  const [count, setCount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconcileOrder, setReconcileOrder] = useState<Order | null>(null);
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDQ(q);
      setPage(0); // Reset page on query search
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchOrders = useCallback(
    async (query: string, status: string, pageIndex: number) => {
      requestSeq.current += 1;
      const reqId = requestSeq.current;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);
      setData([]);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (status) params.set("status", status);
        params.set("limit", String(LIMIT));
        params.set("offset", String(pageIndex * LIMIT));

        const res = await authorizedFetch(`/api/admin/orders?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (reqId !== requestSeq.current) return;

        setData(json.data ?? []);
        setCount(json.count ?? 0);
        setTotalPaid(json.totalPaid ?? 0);
      } catch (e: unknown) {
        if (ctrl.signal.aborted) return;
        if (reqId !== requestSeq.current) return;
        setError(getErrorMessage(e));
      } finally {
        if (reqId !== requestSeq.current) return;
        setLoading(false);
      }
    },
    [LIMIT],
  );

  useEffect(() => {
    if (activeStatus === "offers") return;
    fetchOrders(debouncedQ, activeStatus, page);
  }, [debouncedQ, activeStatus, page, fetchOrders]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  /* Carrying out a consultation or sending a parcel is the operator's step, and
     the list is where they see it. Optimistic: the select shows the new state
     at once and returns to the old one if the server refuses. */
  const setFulfilment = async (order: Order, next: FulfilmentStatus) => {
    const previous = order.fulfilment_status;
    setData((rows) =>
      rows.map((row) => (row.order_ref === order.order_ref ? { ...row, fulfilment_status: next } : row)),
    );
    const res = await authorizedFetch("/api/admin/orders/fulfilment", {
      method: "PATCH",
      body: JSON.stringify({ order_ref: order.order_ref, status: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setData((rows) =>
        rows.map((row) => (row.order_ref === order.order_ref ? { ...row, fulfilment_status: previous } : row)),
      );
      setError(t("orders_fulfilment_failed"));
    }
  };

  const handleStatusChange = (status: string) => {
    setStatus(status);
    setPage(0);
  };

  const getOrdersCountLabel = (value: number) => {
    if (value === 0) return t("orders_count_zero");
    if (!isUk) return `${value} ${t("orders_count_en")}`;
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return `${value} ${t("orders_count_one")}`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${t("orders_count_few")}`;
    return `${value} ${t("orders_count_many")}`;
  };

  const totalPages = Math.ceil(count / LIMIT);

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div className={pageStyles.heading}>
          <h2 className={pageStyles.title}>{t("orders_title")}</h2>
          <p className={pageStyles.subtitle}>{t("orders_subtitle")}</p>
        </div>
        {!loading && data.length > 0 && activeStatus !== "created" && activeStatus !== "offers" && (
          <div className={pageStyles.headerFigure}>
            <p className={pageStyles.headerFigureLabel}>{t("orders_total_paid")}</p>
            <p className={pageStyles.headerFigureValue}>
              {totalPaid.toLocaleString(locale)}{" "}
              <span className={pageStyles.headerFigureUnit}>{t("common_currency_uah")}</span>
            </p>
          </div>
        )}
      </div>

      {/* Status tabs */}
      <AdminTabs items={STATUS_TABS} activeKey={activeStatus} onChange={handleStatusChange} />

      {activeStatus === "offers" ? (
        <PersonalOfferPanel labels={personalOfferLabels} />
      ) : (
        <>
          {/* Search */}
          <AdminSearchInput
            value={q}
            onChange={setQ}
            placeholder={t("orders_search_placeholder")}
            onClear={q ? () => setQ("") : undefined}
          />

          {/* Count */}
          {!loading && <p className={pageStyles.resultsNote}>{getOrdersCountLabel(count)}</p>}

          {/* Loading skeletons */}
          {loading && <AdminLoadingState variant="skeleton" rows={6} />}

          {/* Error */}
          {error && !loading && (
            <AdminErrorState
              title={t("common_error")}
              message={error}
              action={
                <button
                  type="button"
                  onClick={() => fetchOrders(debouncedQ, activeStatus, page)}
                  className={`${controls.action} cw-surface-2`}
                >
                  {t("analytics_retry")}
                </button>
              }
            />
          )}

          {/* Empty */}
          {!loading && !error && data.length === 0 && (
            <AdminEmptyState
              icon={<Icon className="cw-muted" name="document" size={20} />}
              description={t("orders_empty")}
            />
          )}

          {/* Orders table */}
          {!loading && !error && data.length > 0 && (
            <div className={lists.list}>
              {data.map((order) => {
                const customer = order.customers;
                const customerLabel = customer?.display_name ?? customer?.email ?? customer?.phone ?? null;

                return (
                  /* THE ROW STACKS; THE REFERENCE IS NOT TRUNCATED.

                               At 375pt the content column is 283px wide and
                               `order_ref` is a 30-character mono string. The
                               row read this as four side-by-side zones at every
                               width, so the reference broke at its one hyphen,
                               ran past the `flex-1` box it was sitting in — an
                               unbreakable word overflows a `min-w-0` parent
                               rather than shrinking it — and printed straight
                               through `4 100 UAH`. Every row, not the long ones.

                               The reference is the row's identity and the thing
                               an operator copies into a payment provider, so it
                               is not the part to shorten: an ellipsis eats the
                               tail hash, which is exactly what separates two
                               orders of the same course on the same day. Amount
                               and time are the secondary read, so they take
                               their own line below the identifier until `sm`,
                               where the four zones fit again. `break-words`
                               backs it up: even on its own line the reference
                               needs a break opportunity a hyphen does not give
                               it. The dot moves from the row's vertical centre
                               to the first line, because a status mark belongs
                               beside the identifier it qualifies, not beside
                               whatever happens to be the middle of a row whose
                               height now changes with the viewport. */
                  <div key={order.id} className={lists.orderRow}>
                    {/* Status dot */}
                    <div
                      className={`${lists.statusDotSmall} ${
                        order.status === "paid"
                          ? "cw-status-success-dot"
                          : order.status === "refunded"
                            ? "cw-status-failed-dot"
                            : "cw-status-pending-dot"
                      }`}
                    />

                    <div className={lists.orderBody}>
                      {/* Main info */}
                      <div className={lists.orderMain}>
                        <div className={lists.orderIdentity}>
                          <span className={lists.orderRef}>{order.order_ref}</span>
                          <span className={ORDER_STATUS_BADGE_CLASS[order.status] ?? "cw-surface-2 cw-muted"}>
                            {statusLabel[order.status] ?? order.status}
                          </span>
                        </div>
                        <div className={lists.orderSub}>
                          <span className={lists.orderSubMuted}>{order.product_code}</span>
                          {order.fulfilment_status ? (
                            <select
                              value={order.fulfilment_status}
                              onChange={(e) => void setFulfilment(order, e.target.value as FulfilmentStatus)}
                              aria-label={t("orders_fulfilment_label")}
                              className={`${controls.select} ${controls.selectNarrow}`}
                            >
                              {FULFILMENT_STATUSES.map((step) => (
                                <option key={step} value={step}>
                                  {fulfilmentLabel[step]}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {customerLabel && (
                            <>
                              <span className={lists.orderSubMuted}>·</span>
                              {order.customer_id ? (
                                <Link
                                  href={`/admin/customers/${order.customer_id}`}
                                  className={`cw-link-hover ${lists.orderCustomerMeasure}`}
                                >
                                  {customerLabel}
                                </Link>
                              ) : (
                                <span className={lists.orderCustomer}>{customerLabel}</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className={lists.orderAmount}>
                        {order.amount != null && (
                          <p className={lists.orderSum}>
                            {order.amount.toLocaleString(locale)}{" "}
                            <span className={lists.orderCurrency}>{order.currency}</span>
                          </p>
                        )}
                        <p className={lists.orderWhen}>
                          {new Date(order.created_at).toLocaleDateString(locale, {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {order.status !== "paid" ? (
                      <button
                        type="button"
                        onClick={() => setReconcileOrder(order)}
                        title={t("orders_manual_reconcile")}
                        aria-label={t("orders_manual_reconcile")}
                        className={`cw-icon-btn ${lists.rowAction}`}
                      >
                        <InteractionInkIcon>
                          <Icon name="check" size={16} />
                        </InteractionInkIcon>
                      </button>
                    ) : (
                      <ResendAccessButton orderRef={order.order_ref} labels={copyLabels} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && count > 0 && (
            <AdminPagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          )}

          {/* Reconcile modal */}
          {reconcileOrder && (
            <ReconcileModal
              order={reconcileOrder}
              onClose={() => setReconcileOrder(null)}
              labels={reconcileLabels}
              statusLabels={statusLabel}
              onDone={() => {
                setReconcileOrder(null);
                fetchOrders(debouncedQ, activeStatus, page);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
