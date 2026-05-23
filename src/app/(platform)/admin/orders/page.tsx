"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { ReconcileModal } from "@/components/admin/modals/ReconcileModal";
import { useToast } from "@/components/ToastProvider";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/adminLocale";
import { ORDER_STATUS_BADGE_CLASS } from "@/lib/adminStatusStyles";

interface Order {
    id: string;
    order_ref: string;
    product_code: string;
    amount: number | null;
    currency: string | null;
    status: string;
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

function ResendAccessButton({ orderRef, labels }: {
    orderRef: string;
    labels: { copied: string; copyLink: string; createError: string; networkError: string; unknown: string; };
}) {
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const toast = useToast();

    const handle = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch("/api/tokens/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_ref: orderRef }),
            });
            const data = await res.json();
            if (data.ok && data.token) {
                // Return a full URL if possible, assuming /pay/return?token=... or something similar.
                // For now, we craft a generic access link.
                const baseUrl = window.location.origin;
                const link = `${baseUrl}/pay/return?token=${data.token}`;
                await navigator.clipboard.writeText(link);
                setCopied(true);
                toast.success(labels.copied);
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
            className="shrink-0 cw-icon-btn opacity-0 group-hover:opacity-100"
        >
            {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cw-status-success-text">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
            )}
        </button>
    );
}

function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === "\"") {
            if (insideQuotes && line[index + 1] === "\"") {
                current += "\"";
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

    if (lines.length === 0) {
        return [];
    }

    const firstRow = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
    const hasHeader = firstRow.includes("recipient_key") || firstRow.includes("recipientkey");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const headerIndex = new Map<string, number>();

    if (hasHeader) {
        parseCsvLine(lines[0]).forEach((value, index) => {
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
            ? (recipientKey.trim()
                ? [{
                    recipientKey: recipientKey.trim(),
                    channel: channel.trim() || null,
                    campaign: campaign.trim() || null,
                    note: note.trim() || null,
                }]
                : [])
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
        activeMode === "single" ? labels.modeSingle :
            activeMode === "bulk" ? labels.modeBulk :
                labels.modeCsv;

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
            ["recipient_key", "channel", "campaign", "note", "offerToken", "landingPromoUrl", "batchId", "status", "price", "currency"],
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
                        return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
                    })
                    .join(",")
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
            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch("/api/admin/landing-offers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
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

            if (response.offers.length === 1) {
                await copyLandingUrl(response.offers[0].landingUrl);
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
        <div className="cw-panel p-4 sm:p-5 md:p-6 space-y-4">
            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold cw-text">{labels.title}</h3>
                <p className="text-sm cw-muted">{labels.subtitle}</p>
            </div>

            <AdminTabs items={MODE_TABS} activeKey={activeMode} onChange={setActiveMode} />

            <div className="cw-list-item p-4 space-y-3">
                <label className="flex flex-col gap-1.5">
                    <span className="text-xs cw-muted">{labels.productLabel}</span>
                    <div className="cw-input px-3 py-2.5 text-sm cw-muted">{labels.productValue}</div>
                </label>
                {activeMode === "single" ? (
                    <div className="space-y-2">
                        <p className="text-xs cw-muted">{labels.modeSingleHint}</p>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs cw-muted">{labels.recipientLabel}</span>
                            <input
                                type="text"
                                value={recipientKey}
                                onChange={(event) => setRecipientKey(event.target.value)}
                                placeholder={labels.recipientPlaceholder}
                                className="cw-input px-3 py-2.5 text-sm"
                            />
                        </label>
                    </div>
                ) : null}
                {activeMode === "bulk" ? (
                    <div className="space-y-2">
                        <p className="text-xs cw-muted">{labels.modeBulkHint}</p>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs cw-muted">{labels.bulkLabel}</span>
                            <textarea
                                value={bulkRecipients}
                                onChange={(event) => setBulkRecipients(event.target.value)}
                                placeholder={labels.bulkPlaceholder}
                                className="cw-input min-h-[112px] px-3 py-2.5 text-sm resize-y"
                            />
                        </label>
                    </div>
                ) : null}
                {activeMode === "csv" ? (
                    <div className="space-y-2">
                        <p className="text-xs cw-muted">{labels.modeCsvHint}</p>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs cw-muted">{labels.csvLabel}</span>
                            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                <input
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={handleCsvUpload}
                                    className="cw-input px-3 py-2.5 text-sm"
                                />
                                {csvFileName ? <span className="text-xs cw-muted">{labels.csvLoaded}: {csvFileName}</span> : null}
                            </div>
                            <p className="text-xs cw-muted">{labels.csvHelper}</p>
                        </label>
                    </div>
                ) : null}
            </div>

            <div className="cw-list-item p-4 space-y-3">
                <div className="space-y-1">
                    <p className="text-sm font-medium cw-text">{labels.settingsTitle}</p>
                    <p className="text-xs cw-muted">{labels.settingsSubtitle}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                    <span className="text-xs cw-muted">{labels.channelLabel}</span>
                    <input
                        type="text"
                        value={channel}
                        onChange={(event) => setChannel(event.target.value)}
                        placeholder={labels.channelPlaceholder}
                        className="cw-input px-3 py-2.5 text-sm"
                    />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-xs cw-muted">{labels.campaignLabel}</span>
                    <input
                        type="text"
                        value={campaign}
                        onChange={(event) => setCampaign(event.target.value)}
                        placeholder={labels.campaignPlaceholder}
                        className="cw-input px-3 py-2.5 text-sm"
                    />
                </label>
                </div>
            </div>

            <label className="flex flex-col gap-1.5">
                <span className="text-xs cw-muted">{labels.noteLabel}</span>
                <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={labels.notePlaceholder}
                    className="cw-input min-h-[88px] px-3 py-2.5 text-sm resize-y"
                />
            </label>

            <div className="cw-list-item p-4 space-y-2">
                <p className="text-sm font-medium cw-text">{labels.previewTitle}</p>
                <p className="text-xs cw-muted">{labels.previewReady}</p>
                <div className="flex flex-wrap gap-3 text-xs cw-muted">
                    <span>{labels.previewMode}: {currentModeLabel}</span>
                    <span>{labels.previewRecipients}: {previewRecipientCount}</span>
                    <span>{labels.previewDeduped}: {dedupedRecipients.length}</span>
                    <span>{labels.previewChannels}: {previewChannels.length > 0 ? previewChannels.join(", ") : "—"}</span>
                </div>
                {csvEntries.length > 0 ? <p className="text-xs cw-muted">{labels.csvLoaded}: {csvFileName}</p> : null}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-xs cw-muted">{labels.helper}</p>
                <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:w-[320px]">
                    <button
                        type="button"
                        onClick={clearAllInputs}
                        className="cw-btn cw-surface-2 min-h-[44px] w-full px-4 py-2 text-sm"
                    >
                        {labels.clear}
                    </button>
                    <button
                        type="button"
                        onClick={handleIssue}
                        disabled={loading}
                        className="cw-btn cw-surface-2 min-h-[44px] w-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? labels.submitting : labels.submit}
                    </button>
                </div>
            </div>

            {issuedOffers.length > 0 && (
                <div className="cw-list-item p-4 space-y-3">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium cw-text">{issuedOffers.length > 1 ? labels.latestBatch : labels.latest}</p>
                        {issuedSummary ? (
                            <div className="flex flex-wrap gap-3 text-xs cw-muted">
                                <span>{labels.previewRecipients}: {issuedSummary.totalIssued}</span>
                                <span>{labels.previewDeduped}: {issuedSummary.totalDeduped}</span>
                                {issuedBatchId ? <span>{labels.batchIdLabel}: {issuedBatchId}</span> : null}
                            </div>
                        ) : null}
                    </div>
                    {issuedOffers.length > 1 ? (
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => copyAllLandingUrls(issuedOffers)}
                                className="cw-icon-btn"
                                title={labels.copyAll}
                                aria-label={labels.copyAll}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <rect x="9" y="3" width="12" height="12" rx="2" ry="2" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={downloadIssuedCsv}
                                className="cw-icon-btn"
                                title={labels.downloadCsv}
                                aria-label={labels.downloadCsv}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                        </div>
                    ) : null}
                    <div className="space-y-3">
                        {issuedOffers.slice(0, 24).map((offer) => (
                            <div key={offer.offerToken} className="border-b cw-border last:border-b-0 pb-3 last:pb-0">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-mono cw-text break-all">{offer.landingUrl}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => copyLandingUrl(offer.landingUrl)}
                                            className="cw-icon-btn"
                                            title={copiedUrl === offer.landingUrl ? labels.copied : labels.copy}
                                            aria-label={copiedUrl === offer.landingUrl ? labels.copied : labels.copy}
                                        >
                                            {copiedUrl === offer.landingUrl ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cw-status-success-text">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            )}
                                        </button>
                                        <a
                                            href={offer.landingUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="cw-icon-btn"
                                            title={labels.open}
                                            aria-label={labels.open}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M7 17 17 7" />
                                                <path d="M7 7h10v10" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs cw-muted mt-2">
                                    <span>{labels.price}: {offer.amount.toLocaleString("uk-UA")} {offer.currency}</span>
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
    const isRu = lang === "ru";
    const locale = getAdminLocale(lang);
    const statusLabel: Record<string, string> = {
        paid: t("orders_status_paid"),
        created: t("orders_status_created"),
        pending: t("orders_status_pending"),
        refunded: t("orders_status_refunded"),
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

    const fetchOrders = useCallback(async (query: string, status: string, pageIndex: number) => {
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

            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch(`/api/admin/orders?${params}`, {
                signal: ctrl.signal,
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
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
    }, [LIMIT]);

    useEffect(() => {
        if (activeStatus === "offers") return;
        fetchOrders(debouncedQ, activeStatus, page);
    }, [debouncedQ, activeStatus, page, fetchOrders]);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const handleStatusChange = (status: string) => {
        setStatus(status);
        setPage(0);
    };

    const getOrdersCountLabel = (value: number) => {
        if (value === 0) return t("orders_count_zero");
        if (!isRu) return `${value} ${t("orders_count_en")}`;
        const mod10 = value % 10;
        const mod100 = value % 100;
        if (mod10 === 1 && mod100 !== 11) return `${value} ${t("orders_count_one")}`;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${t("orders_count_few")}`;
        return `${value} ${t("orders_count_many")}`;
    };

    const totalPages = Math.ceil(count / LIMIT);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="cw-page-title mb-1">{t("orders_title")}</h2>
                    <p className="cw-page-subtitle">{t("orders_subtitle")}</p>
                </div>
                {!loading && data.length > 0 && activeStatus !== "created" && activeStatus !== "offers" && (
                    <div className="text-right">
                        <p className="text-xs cw-muted">{t("orders_total_paid")}</p>
                        <p className="text-xl font-bold cw-text mt-0.5">
                            {totalPaid.toLocaleString(locale)} <span className="text-sm font-normal cw-muted">{t("common_currency_uah")}</span>
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
            {!loading && (
                <p className="text-xs cw-muted">
                    {getOrdersCountLabel(count)}
                </p>
            )}

            {/* Loading skeletons */}
            {loading && (
                <AdminLoadingState variant="skeleton" rows={6} rowClassName="h-[72px]" />
            )}

            {/* Error */}
            {error && !loading && (
                <AdminErrorState
                    title={t("common_error")}
                    message={error}
                    action={(
                        <button type="button" onClick={() => fetchOrders(debouncedQ, activeStatus, page)} className="px-4 py-2 cw-btn cw-surface-2">
                            {t("analytics_retry")}
                        </button>
                    )}
                />
            )}

            {/* Empty */}
            {!loading && !error && data.length === 0 && (
                <AdminEmptyState
                    className="py-16"
                    icon={(
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                    )}
                    description={t("orders_empty")}
                />
            )}

            {/* Orders table */}
            {!loading && !error && data.length > 0 && (
                <div className="space-y-1.5">
                    {data.map((order) => {
                        const customer = order.customers;
                        const customerLabel = customer?.display_name ?? customer?.email ?? customer?.phone ?? null;

                        return (
                            <div
                                key={order.id}
                                className="cw-list-item flex items-center gap-4 p-4 group"
                            >
                                {/* Status dot */}
                                <div className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${order.status === "paid" ? "cw-status-success-dot" :
                                    order.status === "refunded" ? "cw-status-failed-dot" : "cw-status-pending-dot"
                                    }`} />

                                {/* Main info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-mono font-medium cw-text">
                                            {order.order_ref}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_BADGE_CLASS[order.status] ?? "cw-surface-2 cw-muted"}`}>
                                            {statusLabel[order.status] ?? order.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs cw-muted">{order.product_code}</span>
                                        {customerLabel && (
                                            <>
                                                <span className="cw-muted">·</span>
                                                {order.customer_id ? (
                                                    <Link href={`/admin/customers/${order.customer_id}`}
                                                        className="text-xs cw-link-hover truncate max-w-[180px]">
                                                        {customerLabel}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs cw-muted truncate max-w-[180px]">{customerLabel}</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="text-right shrink-0">
                                    {order.amount != null && (
                                        <p className="text-sm font-semibold cw-text">
                                            {order.amount.toLocaleString(locale)} <span className="text-xs font-normal cw-muted">{order.currency}</span>
                                        </p>
                                    )}
                                    <p className="text-[10px] cw-muted mt-0.5">
                                        {new Date(order.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>

                                {/* Actions */}
                                {order.status !== "paid" ? (
                                    <button
                                        onClick={() => setReconcileOrder(order)}
                                        title={t("orders_manual_reconcile")}
                                        className="shrink-0 cw-icon-btn opacity-0 group-hover:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
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
