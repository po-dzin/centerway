"use client";

/**
 * Prices for the products that have no course of their own.
 *
 * WHY THIS TAB EXISTS. `admin/catalog`'s pricing tab writes `lms_course_offers`,
 * which is unique on `course_id` — one course, one row. Two products were never
 * going to fit: `way21-support` is a second offer against the way21 course, and
 * `herbs` is not a course at all. Their price lived in `products.ts`, so
 * changing it took a deployment. `consult` and `irem-individual` had no price
 * anywhere — they are not even in that file — so "what does this cost" was a
 * question only a developer could answer for them.
 *
 * `product_offers` (2026-09-03) is their table, this is its screen, and
 * `/api/admin/catalog/products` is the endpoint. Same split as the course
 * price: any admin session may read (knowing the cost answers a buyer),
 * writing is admin-only (the price is the owner's).
 *
 * A CHECKOUT PRICE AND A QUOTE ARE NOT THE SAME FIELD. `herbs` is charged at a
 * checkout; `way21-support` and `consult` are agreed in conversation and
 * invoiced afterward — their landing prints a figure beside a lead form, with
 * no buy button. `kind` says which, and `loadPayableOffer` refuses a checkout
 * for a "lead" row even when it carries a number, so a price typed here cannot
 * silently open a buy button that never existed.
 *
 * AN EMPTY AMOUNT IS «ЦІНА ЗА ЗАПИТОМ», not zero and not "unset" — the row and
 * the checkout both treat it as a real, meaningful state. The input is left
 * blank on purpose rather than defaulting to a placeholder number.
 */

import { useState } from "react";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { getErrorMessage } from "@/lib/errors";
import { supabaseClient } from "@/lib/supabaseClient";
import type { ProductOfferRow } from "@/lib/admin/productOfferTypes";

async function authFetch(input: string, init: RequestInit = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch(input, {
        ...init,
        headers: {
            ...(init.headers ?? {}),
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String((payload as { error?: string }).error ?? res.status));
    return payload;
}

function EmptyIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
            <path d="M12 2 2 7l10 5 10-5-10-5Z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
        </svg>
    );
}

export function ProductPricingTab({
    products,
    canEdit,
    errorText,
    onChanged,
}: {
    products: ProductOfferRow[];
    canEdit: boolean;
    errorText: (message: string) => string;
    onChanged: () => Promise<void>;
}) {
    const { t } = useI18n();

    if (products.length === 0) {
        return (
            <AdminEmptyState
                className="py-16"
                iconWrapperClassName="w-12 h-12 rounded-full"
                icon={<EmptyIcon />}
                description={t("catalog_empty")}
            />
        );
    }

    return (
        <div className="space-y-1.5">
            {products.map((row) => (
                <ProductPricingRow key={row.code} row={row} canEdit={canEdit} errorText={errorText} onChanged={onChanged} />
            ))}
        </div>
    );
}

function ProductPricingRow({
    row,
    canEdit,
    errorText,
    onChanged,
}: {
    row: ProductOfferRow;
    canEdit: boolean;
    errorText: (message: string) => string;
    onChanged: () => Promise<void>;
}) {
    const { t } = useI18n();
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const [amount, setAmount] = useState(row.offer?.amount != null ? String(row.offer.amount) : "");
    const [listAmount, setListAmount] = useState(row.offer?.listAmount != null ? String(row.offer.listAmount) : "");
    const [kind, setKind] = useState<"checkout" | "lead">(row.offer?.kind ?? row.expectedKind);

    const save = async () => {
        setBusy(true);
        try {
            await authFetch("/api/admin/catalog/products", {
                method: "PATCH",
                body: JSON.stringify({
                    code: row.code,
                    action: "save",
                    amount: amount.trim() === "" ? null : Number(amount),
                    listAmount: listAmount.trim() === "" ? null : Number(listAmount),
                    kind,
                }),
            });
            toast.success(t("products_saved"));
            await onChanged();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (active: boolean) => {
        setBusy(true);
        try {
            await authFetch("/api/admin/catalog/products", {
                method: "PATCH",
                body: JSON.stringify({ code: row.code, action: active ? "resume" : "withdraw" }),
            });
            toast.success(t(active ? "products_resumed" : "products_withdrawn"));
            await onChanged();
        } catch (e) {
            toast.error(errorText(getErrorMessage(e)));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="cw-list-item p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium cw-text truncate">{row.title}</p>
                    <div className="text-xs cw-muted flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="font-mono">{row.code}</span>
                        {row.offer && row.offer.amount != null ? (
                            <span>
                                {row.offer.amount} {row.offer.currency}
                                {row.offer.listAmount ? ` · ${t("catalog_quoted")} ${row.offer.listAmount}` : ""}
                            </span>
                        ) : (
                            <span>{t("products_price_on_request")}</span>
                        )}
                        <span>{t(row.expectedKind === "lead" ? "products_kind_lead" : "products_kind_checkout")}</span>
                        {row.offer && !row.offer.active ? (
                            <span className="cw-status-failed-text">{t("products_inactive")}</span>
                        ) : null}
                    </div>
                    <p className="text-xs cw-muted">
                        {t(row.expectedKind === "lead" ? "products_offer_lead" : "products_offer_checkout")}
                    </p>
                </div>
            </div>

            {canEdit ? (
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs cw-muted">{t("products_amount")}</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            placeholder={t("products_price_on_request")}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="cw-input px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs cw-muted">{t("products_list_amount")}</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={listAmount}
                            onChange={(e) => setListAmount(e.target.value)}
                            className="cw-input px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs cw-muted">{t("products_kind")}</span>
                        <select
                            value={kind}
                            onChange={(e) => setKind(e.target.value === "checkout" ? "checkout" : "lead")}
                            className="cw-input cw-select pl-3 py-2 text-sm"
                        >
                            <option value="checkout">{t("products_kind_checkout")}</option>
                            <option value="lead">{t("products_kind_lead")}</option>
                        </select>
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={busy}
                            className="px-4 py-2 cw-btn cw-surface-2 text-sm disabled:opacity-50"
                        >
                            {t("products_save")}
                        </button>
                        {row.offer ? (
                            <button
                                type="button"
                                onClick={() => void toggleActive(!row.offer?.active)}
                                disabled={busy}
                                className="px-4 py-2 cw-btn cw-btn-muted text-sm disabled:opacity-50"
                            >
                                {t(row.offer.active ? "products_withdraw" : "products_resume")}
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <p className="text-xs cw-muted">{t("access_role_admin_only")}</p>
            )}
            <p className="text-[11px] cw-muted">{t("products_amount_hint")}</p>
        </div>
    );
}
