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
import type { ProductOfferRow } from "@/lib/admin/productOfferTypes";
import { authorizedJson as authFetch } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import { AdminRow } from "@/components/admin/AdminRow";

function EmptyIcon() {
  return <Icon className="cw-muted" name="price" size={20} />;
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
    return <AdminEmptyState icon={<EmptyIcon />} description={t("catalog_empty")} />;
  }

  return (
    <div className={lists.list}>
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
    <AdminRow
      title={row.title}
      meta={
        <>
          <span className={lists.itemCode}>{row.code}</span>
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
        </>
      }
      footer={
        <>
          {canEdit ? (
            <div className={controls.fields}>
              <label className={controls.field}>
                <span className={controls.fieldCaption}>{t("products_amount")}</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder={t("products_price_on_request")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={controls.input}
                />
              </label>
              <label className={controls.field}>
                <span className={controls.fieldCaption}>{t("products_list_amount")}</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={listAmount}
                  onChange={(e) => setListAmount(e.target.value)}
                  className={controls.input}
                />
              </label>
              <label className={controls.field}>
                <span className={controls.fieldCaption}>{t("products_kind")}</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value === "checkout" ? "checkout" : "lead")}
                  className={controls.select}
                >
                  <option value="checkout">{t("products_kind_checkout")}</option>
                  <option value="lead">{t("products_kind_lead")}</option>
                </select>
              </label>
              <div className={controls.actions}>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy}
                  className={`${controls.action} cw-surface-2`}
                >
                  {t("products_save")}
                </button>
                {row.offer ? (
                  <button
                    type="button"
                    onClick={() => void toggleActive(!row.offer?.active)}
                    disabled={busy}
                    className={`${controls.action} cw-btn-muted`}
                  >
                    {t(row.offer.active ? "products_withdraw" : "products_resume")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className={controls.hint}>{t("access_role_admin_only")}</p>
          )}
          <p className={controls.hint}>{t("products_amount_hint")}</p>
        </>
      }
    >
      <p className={controls.hint}>
        {t(row.expectedKind === "lead" ? "products_offer_lead" : "products_offer_checkout")}
      </p>
    </AdminRow>
  );
}
