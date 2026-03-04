"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { getErrorMessage } from "@/lib/errors";

type FunnelData = {
    date: string;
    leads_count: number;
    unique_lead_phones: number;
    orders_created: number;
    orders_paid: number;
    total_revenue: number;
    conversion_rate_percent: string;
};

type CampaignData = {
    source_campaign: string;
    total_orders: number;
    paid_orders: number;
    total_revenue: number;
};

type AnalyticsSummary = {
    totalLeads: number;
    totalPaidOrders: number;
    totalRevenue: number;
    avgConversionRate: string;
};

export default function AnalyticsPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [funnel, setFunnel] = useState<FunnelData[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [hovered, setHovered] = useState<{ day: FunnelData; x: number } | null>(null);
    const chartWrapRef = useRef<HTMLDivElement | null>(null);

    const [adSpend, setAdSpend] = useState<number>(0);

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const res = await fetch("/api/admin/analytics", {
                headers: session ? { "Authorization": `Bearer ${session.access_token}` } : {}
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || `Failed to load analytics (${res.status})`);
            }
            setFunnel(data.funnel);
            setCampaigns(data.campaigns);
            setSummary(data.summary);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const roi = useMemo(() => {
        if (!summary || adSpend <= 0) return 0;
        return (((summary.totalRevenue - adSpend) / adSpend) * 100).toFixed(2);
    }, [summary, adSpend]);

    const cpa = useMemo(() => {
        if (!summary || summary.totalPaidOrders === 0 || adSpend <= 0) return 0;
        return (adSpend / summary.totalPaidOrders).toFixed(2);
    }, [summary, adSpend]);

    if (error) {
        return (
            <div className="p-8 text-center cw-status-failed-text">
                <p>{t("analytics_load_error")}: {error}</p>
                <div className="mt-4 text-sm cw-muted">
                    <>{t("analytics_sql_reminder")}</>
                </div>
                <button onClick={fetchAnalytics} className="mt-4 px-4 py-2 rounded border cw-border cw-surface-2 cw-text hover:bg-[var(--cw-accent-soft)] transition-colors">
                    {t("analytics_retry")}
                </button>
            </div>
        );
    }

    if (loading || !summary) {
        return <div className="p-8 text-center cw-muted animate-pulse">{t("analytics_loading")}</div>;
    }

    // Chart dimensions
    const chartHeight = 150;
    const maxRevenue = Math.max(...funnel.map(f => f.total_revenue), 1);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center cw-surface p-6 rounded-2xl border cw-border cw-shadow">
                <div>
                    <h1 className="text-2xl font-bold cw-text">{t("analytics_title")}</h1>
                    <p className="cw-muted text-sm mt-1">{t("analytics_subtitle")}</p>
                </div>
                <button onClick={fetchAnalytics} className="px-4 py-2 border cw-border rounded-lg hover:bg-[var(--cw-accent-soft)] transition-colors text-sm font-medium cw-text">
                    {t("analytics_refresh")}
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
                    <div className="text-sm font-medium cw-muted">{t("analytics_leads")}</div>
                    <div className="text-3xl font-bold mt-2 cw-text">{summary.totalLeads}</div>
                </div>
                <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
                    <div className="text-sm font-medium cw-muted">{t("analytics_purchases")}</div>
                    <div className="text-3xl font-bold mt-2 cw-text">{summary.totalPaidOrders}</div>
                </div>
                <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
                    <div className="text-sm font-medium cw-muted">{t("analytics_funnel_conversion")}</div>
                    <div className="text-3xl font-bold mt-2 cw-text">{summary.avgConversionRate}%</div>
                </div>
                <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow relative overflow-hidden">
                    <div className="text-sm font-medium cw-muted">{t("analytics_revenue_all_time")}</div>
                    <div className="text-3xl font-bold mt-2 cw-text">{summary.totalRevenue.toLocaleString()} ₴</div>
                </div>
            </div>

            {/* ROI / CPA Calculator Sandbox */}
            <div className="cw-surface border cw-border p-6 rounded-2xl cw-shadow">
                <h2 className="text-lg font-semibold cw-text mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 cw-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {t("analytics_roi_cpa")}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div>
                        <label className="block text-sm font-medium cw-muted mb-1">{t("analytics_ad_spend")}</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 cw-muted">₴</span>
                            <input
                                type="number"
                                value={adSpend || ""}
                                onChange={(e) => setAdSpend(parseFloat(e.target.value))}
                                className="pl-8 block w-full rounded-md border cw-border cw-surface sm:text-sm py-2 px-3 focus:outline-none cw-text placeholder:text-[var(--cw-muted)]"
                                placeholder={t("analytics_ad_spend_placeholder")}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-sm cw-muted">{t("analytics_cpa")}</span>
                        <span className={`text-2xl font-bold ${adSpend > 0 ? "cw-text" : "cw-muted"}`}>
                            {adSpend > 0 ? `${cpa} ₴` : "— ₴"}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-sm cw-muted">{t("analytics_roi")}</span>
                        <span className={`text-2xl font-bold ${adSpend > 0 ? "cw-text" : "cw-muted"}`}>
                            {adSpend > 0 ? `${roi}%` : "— %"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Daily Revenue Chart (Simple CSS implementation) */}
            <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
                <h2 className="text-lg font-medium mb-6 cw-text">{t("analytics_daily_revenue")}</h2>
                {funnel.length === 0 ? (
                    <div className="text-center text-sm cw-muted py-10">{t("analytics_no_chart_data")}</div>
                ) : (
                    <div ref={chartWrapRef} className="relative overflow-visible">
                        {hovered && (
                            <div
                                className="absolute z-40 -top-2 -translate-x-1/2 -translate-y-full border cw-border cw-shadow cw-text text-xs rounded-md py-1.5 px-2.5 whitespace-nowrap pointer-events-none"
                                style={{
                                    left: `${Math.max(64, Math.min(hovered.x, (chartWrapRef.current?.clientWidth ?? hovered.x) - 64))}px`,
                                    backgroundColor: "var(--cw-surface-solid)",
                                }}
                            >
                                <div className="font-semibold">{hovered.day.date}</div>
                                <div className="cw-muted">{t("analytics_tooltip_revenue")}: <span className="cw-text">{hovered.day.total_revenue} ₴</span></div>
                                <div className="cw-muted">{t("analytics_tooltip_leads")}: <span className="cw-text">{hovered.day.leads_count}</span></div>
                                <div className="cw-muted">{t("analytics_tooltip_paid")}: <span className="cw-text">{hovered.day.orders_paid}</span></div>
                            </div>
                        )}
                        <div className="overflow-x-auto pb-2 custom-scrollbar">
                            <div className="flex items-end gap-1 h-[150px] min-w-max">
                                {funnel.map((day, idx) => {
                                    const barHeight = Math.max((day.total_revenue / maxRevenue) * chartHeight, 2);
                                    return (
                                        <div
                                            key={idx}
                                            className="flex flex-col items-center flex-1 min-w-[20px] relative"
                                            onMouseEnter={(e) => {
                                                const wrapRect = chartWrapRef.current?.getBoundingClientRect();
                                                const x = wrapRect ? e.clientX - wrapRect.left : 0;
                                                setHovered({ day, x });
                                            }}
                                            onMouseMove={(e) => {
                                                const wrapRect = chartWrapRef.current?.getBoundingClientRect();
                                                const x = wrapRect ? e.clientX - wrapRect.left : 0;
                                                setHovered({ day, x });
                                            }}
                                            onMouseLeave={() => setHovered(null)}
                                        >
                                            <div className="w-full cw-chart-bar rounded-t-sm" style={{ height: `${barHeight}px` }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Campaign Breakdown Table */}
            <div className="cw-surface rounded-2xl border cw-border cw-shadow overflow-hidden">
                <div className="px-6 py-5 border-b cw-border">
                    <h2 className="text-lg font-medium cw-text">{t("analytics_campaign_breakdown")}</h2>
                    <p className="text-sm cw-muted mt-1">{t("analytics_campaign_breakdown_subtitle")}</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y" style={{ borderColor: "var(--cw-border)" }}>
                        <thead className="cw-surface-2">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">{t("analytics_col_source_campaign")}</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">{t("analytics_col_orders")}</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">{t("analytics_col_paid")}</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">{t("analytics_col_revenue")}</th>
                            </tr>
                        </thead>
                        <tbody className="cw-surface divide-y" style={{ borderColor: "var(--cw-border)" }}>
                            {campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-sm cw-muted">{t("analytics_no_campaign_data")}</td>
                                </tr>
                            ) : (
                                campaigns.map((camp, idx) => (
                                    <tr key={idx} className="hover:bg-[var(--cw-accent-soft)] transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium cw-text">
                                            {camp.source_campaign || t("analytics_organic_direct")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm cw-muted">{camp.total_orders}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm cw-muted">{camp.paid_orders}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium cw-text">{camp.total_revenue} ₴</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
