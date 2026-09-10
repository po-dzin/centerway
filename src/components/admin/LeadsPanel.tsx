"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Icon } from "@/components/Icon";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAdminLocale } from "@/lib/adminLocale";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ToastProvider";

/* The four stages, in the order a lead travels them. Kept as data rather than
   as markup so the tab strip, the row control and the "is this closed" test all
   read the same list — the bug this column exists to prevent is a sequence that
   keeps writing to somebody because one place forgot a stage. */
const STAGES = ["new", "in_progress", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];
const CLOSED_STAGES: readonly Stage[] = ["won", "lost"];

const STAGE_LABEL_KEY: Record<Stage, string> = {
    new: "leads_stage_new",
    in_progress: "leads_stage_in_progress",
    won: "leads_stage_won",
    lost: "leads_stage_lost",
};

/* Ink, not colour-coding: a won lead reads as settled and a lost one as spent,
   which the platform says with weight and muting rather than with a green and a
   red badge. */
const STAGE_TONE: Record<Stage, string> = {
    new: "cw-status-running-badge",
    in_progress: "cw-status-running-badge",
    won: "cw-status-success-badge",
    lost: "cw-muted",
};

type Lead = {
    id: string;
    order_ref: string;
    product_code: string | null;
    product_title: string | null;
    source: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    stage: Stage;
    stage_changed_at: string | null;
    created_at: string;
    dosha_result_type: string | null;
    dosha_claimed: string | null;
    message: string | null;
};

const LIMIT = 50;

export function LeadsPanel() {
    const { lang, t } = useI18n();
    const locale = getAdminLocale(lang);
    const { showToast } = useToast();

    const [stage, setStage] = useState<Stage | "">("");
    const [rows, setRows] = useState<Lead[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session?.access_token) throw new Error("no_session");
            const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
            if (stage) params.set("stage", stage);
            const res = await fetch(`/api/admin/leads?${params.toString()}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!res.ok) throw new Error(`request_failed_${res.status}`);
            const payload = await res.json();
            setRows(payload.data ?? []);
            setCount(payload.count ?? 0);
            setCounts(payload.counts ?? {});
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [page, stage]);

    useEffect(() => {
        void load();
    }, [load]);

    const moveStage = async (lead: Lead, next: Stage) => {
        if (next === lead.stage) return;
        setSavingId(lead.id);
        /* Optimistic, and reverted on failure: moving a lead is the one thing
           an operator does here repeatedly, and a round trip between click and
           feedback is what makes a queue feel unusable. */
        const previous = lead.stage;
        setRows((current) => current.map((row) => (row.id === lead.id ? { ...row, stage: next } : row)));
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session?.access_token) throw new Error("no_session");
            const res = await fetch("/api/admin/leads", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ id: lead.id, stage: next }),
            });
            if (!res.ok) throw new Error(`request_failed_${res.status}`);
            await load();
        } catch (err) {
            setRows((current) => current.map((row) => (row.id === lead.id ? { ...row, stage: previous } : row)));
            showToast(getErrorMessage(err), "error");
        } finally {
            setSavingId(null);
        }
    };

    const tabs = [
        { key: "", label: t("leads_tab_all") },
        ...STAGES.map((value) => ({
            key: value,
            label: `${t(STAGE_LABEL_KEY[value] as never)}${counts[value] ? ` (${counts[value]})` : ""}`,
        })),
    ];

    const totalPages = Math.ceil(count / LIMIT);
    const formatDate = (value: string) =>
        new Date(value).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });

    return (
        <div className="space-y-4">
            <AdminTabs
                items={tabs}
                activeKey={stage}
                onChange={(key) => {
                    setStage(key as Stage | "");
                    setPage(0);
                }}
            />

            {loading && <AdminLoadingState variant="skeleton" rows={5} rowClassName="h-20" />}

            {error && !loading && (
                <AdminErrorState
                    title={t("leads_loading_error")}
                    message={error}
                    action={(
                        <button type="button" onClick={() => void load()} className="px-4 py-2 cw-btn cw-surface-2">
                            {t("analytics_retry")}
                        </button>
                    )}
                />
            )}

            {!loading && !error && rows.length === 0 && (
                <AdminEmptyState
                    className="py-16"
                    /* The sprite, not a hand-drawn outline: this panel is new,
                       and new surfaces start on the system's own hand. */
                    icon={<Icon name="mail" size={22} />}
                    description={t("leads_empty")}
                />
            )}

            {!loading && !error && rows.length > 0 && (
                <div className="space-y-1.5">
                    {rows.map((lead) => (
                        <div key={lead.id} className="cw-list-item p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium cw-text truncate">
                                        {lead.name ?? lead.email ?? lead.phone ?? lead.order_ref}
                                    </p>
                                    <p className="text-xs cw-muted truncate">
                                        {[lead.phone, lead.email].filter(Boolean).join(" · ")}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-semibold ${STAGE_TONE[lead.stage]}`}>
                                        {t(STAGE_LABEL_KEY[lead.stage] as never)}
                                    </span>
                                    <select
                                        aria-label={t("leads_stage_change")}
                                        className="text-xs cw-surface-2 border cw-border rounded-lg px-2 py-1 cw-text"
                                        value={lead.stage}
                                        disabled={savingId === lead.id}
                                        onChange={(event) => void moveStage(lead, event.target.value as Stage)}
                                    >
                                        {STAGES.map((value) => (
                                            <option key={value} value={value}>
                                                {t(STAGE_LABEL_KEY[value] as never)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-xs cw-muted">
                                <span>{lead.product_title ?? lead.product_code}</span>
                                <span>·</span>
                                <span>{formatDate(lead.created_at)}</span>
                                {lead.dosha_result_type && (
                                    <>
                                        <span>·</span>
                                        {/* A verified attempt, not a label the page claimed. */}
                                        <span className="cw-text">{t("leads_dosha")}: {lead.dosha_result_type}</span>
                                    </>
                                )}
                                {!lead.dosha_result_type && lead.dosha_claimed && (
                                    <>
                                        <span>·</span>
                                        <span>{t("leads_dosha_claimed")}: {lead.dosha_claimed}</span>
                                    </>
                                )}
                                {CLOSED_STAGES.includes(lead.stage) && lead.stage_changed_at && (
                                    <>
                                        <span>·</span>
                                        <span>{t("leads_closed_at")} {formatDate(lead.stage_changed_at)}</span>
                                    </>
                                )}
                            </div>

                            {lead.message && (
                                <p className="text-xs cw-muted line-clamp-2">{lead.message}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!loading && !error && count > 0 && (
                <AdminPagination
                    page={page}
                    totalPages={totalPages}
                    onPrev={() => setPage((p) => Math.max(0, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                />
            )}
        </div>
    );
}
