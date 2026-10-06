"use client";

/** Prices for standalone services and products. Course formats belong to the
 * program's editor in «Ціни й доступ». Blank price means «за запитом».
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
      <p className={controls.hint}>{t("catalog_products_scope")}</p>
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
          <span>
            {t((row.offer?.kind ?? row.expectedKind) === "lead" ? "products_kind_lead" : "products_kind_checkout")}
          </span>
          {row.offer && !row.offer.active ? (
            <span className="cw-status-failed-text">{t("products_inactive")}</span>
          ) : null}
        </>
      }
      footer={
        <>
          {canEdit ? (
            <div className={controls.priceForm}>
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
              <div className={controls.priceActions}>
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
      note={t((row.offer?.kind ?? row.expectedKind) === "lead" ? "products_offer_lead" : "products_offer_checkout")}
    />
  );
}
