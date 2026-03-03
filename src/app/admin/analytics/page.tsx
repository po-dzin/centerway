"use client";

import { useEffect, useState, useMemo } from "react";

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [funnel, setFunnel] = useState<FunnelData[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

    const [adSpend, setAdSpend] = useState<number>(0);

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/analytics");
            if (!res.ok) throw new Error("Failed to load analytics");
            const data = await res.json();
            setFunnel(data.funnel);
            setCampaigns(data.campaigns);
            setSummary(data.summary);
        } catch (err: any) {
            setError(err.message);
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
            <div className="p-8 text-center text-red-500">
                <p>Failed to load analytics: {error}</p>
                <div className="mt-4 text-sm text-gray-500">
                    Напоминание: вы выполнили SQL скрипт "2026-03-02_analytics_views.sql"?
                </div>
                <button onClick={fetchAnalytics} className="mt-4 px-4 py-2 bg-gray-200 rounded">
                    Повторить загрузку
                </button>
            </div>
        );
    }

    if (loading || !summary) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Загрузка дашборда...</div>;
    }

    // Chart dimensions
    const chartHeight = 150;
    const maxRevenue = Math.max(...funnel.map(f => f.total_revenue), 1);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Сквозная Аналитика</h1>
                    <p className="text-gray-500 text-sm mt-1">Основано на данных из Materialized Views (БД обновляет их раз в период)</p>
                </div>
                <button onClick={fetchAnalytics} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                    Обновить данные
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Лиды (Leads)</div>
                    <div className="text-3xl font-bold mt-2 text-gray-900">{summary.totalLeads}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Оплаты (Purchases)</div>
                    <div className="text-3xl font-bold mt-2 text-indigo-600">{summary.totalPaidOrders}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Конверсия воронки</div>
                    <div className="text-3xl font-bold mt-2 text-emerald-600">{summary.avgConversionRate}%</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="text-sm font-medium text-gray-500">Выручка (All Time)</div>
                    <div className="text-3xl font-bold mt-2 text-purple-600 border-b border-purple-100 pb-1">{summary.totalRevenue.toLocaleString()} ₴</div>
                </div>
            </div>

            {/* ROI / CPA Calculator Sandbox */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-6 rounded-2xl shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Калькулятор ROI & CPA
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Затраты на рекламу (Ad Spend), ₴</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">₴</span>
                            <input
                                type="number"
                                value={adSpend || ""}
                                onChange={(e) => setAdSpend(parseFloat(e.target.value))}
                                className="pl-8 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 px-3 focus:outline-none border bg-white"
                                placeholder="Например, 15000"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-gray-500">Стоимость клиента (CPA)</span>
                        <span className={`text-2xl font-bold ${adSpend > 0 ? "text-gray-900" : "text-gray-300"}`}>
                            {adSpend > 0 ? `${cpa} ₴` : "— ₴"}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-gray-500">Окупаемость (ROI)</span>
                        <span className={`text-2xl font-bold ${adSpend > 0 ? (Number(roi) > 0 ? "text-emerald-500" : "text-red-500") : "text-gray-300"}`}>
                            {adSpend > 0 ? `${roi}%` : "— %"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Daily Revenue Chart (Simple CSS implementation) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h2 className="text-lg font-medium mb-6 text-gray-800">Ежедневная Выручка (Daily Revenue)</h2>
                {funnel.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-10">Нет данных для графика</div>
                ) : (
                    <div className="flex items-end gap-1 h-[150px] overflow-x-auto pb-2 custom-scrollbar">
                        {funnel.map((day, idx) => {
                            const barHeight = Math.max((day.total_revenue / maxRevenue) * chartHeight, 2);
                            return (
                                <div key={idx} className="flex flex-col items-center flex-1 min-w-[20px] group relative">
                                    <div
                                        className="w-full bg-indigo-100 hover:bg-indigo-300 transition-all rounded-t-sm"
                                        style={{ height: `${barHeight}px` }}
                                    ></div>

                                    {/* Tooltip */}
                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap pointer-events-none z-10 transition-opacity">
                                        <div className="font-semibold">{day.date}</div>
                                        <div>Выручка: {day.total_revenue} ₴</div>
                                        <div>Лидов: {day.leads_count}</div>
                                        <div>Оплат: {day.orders_paid}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Campaign Breakdown Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-medium text-gray-800">Разбивка по кампаниям / креативам</h2>
                    <p className="text-sm text-gray-500 mt-1">Основано на utm_campaign/fbp</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Источник (Campaign)</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Заказы</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Оплаты</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">Пока нет данных по кампаниям</td>
                                </tr>
                            ) : (
                                campaigns.map((camp, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {camp.source_campaign || "organic (прямой заход)"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{camp.total_orders}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{camp.paid_orders}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{camp.total_revenue} ₴</td>
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
