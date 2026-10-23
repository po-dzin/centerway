"use client";

/**
 * «Додати продаж» (G 23.10): a product sold outside the site, written as a
 * paid order on the person card. The course twin is the grant dialog in
 * «Доступи»; this one opens no access, so it lists only the standalone things
 * «Ціни» prices, plus a free name for what is not registered yet.
 *
 * Opened from the card it sells to that card; opened from the list it finds
 * the person by email or phone, or makes one.
 */

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminDateField } from "@/components/admin/AdminDateField";
import { authorizedJson } from "@/components/auth/authorizedFetch";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { PAYMENT_CURRENCIES } from "@/lib/admin/accessTypes";
import type { ProductOfferRow } from "@/lib/admin/productOfferTypes";
import { getErrorMessage } from "@/lib/errors";
import controls from "@/components/admin/AdminControls.module.css";
import access from "@/components/admin/AdminAccess.module.css";

const OTHER = "__other";

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function ProductSaleModal({
  customerId,
  onClose,
  onSaved,
}: {
  /** The card to sell to; absent asks who bought. */
  customerId?: string;
  onClose: () => void;
  onSaved: (sale: { customerId: string }) => void;
}) {
  const { lang, t } = useI18n();
  const locale = getAdminLocale(lang);
  const [products, setProducts] = useState<ProductOfferRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState("");
  const [otherTitle, setOtherTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("UAH");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authorizedJson<{ items?: ProductOfferRow[] }>("/api/admin/catalog/products")
      .then((json) => setProducts(json.items ?? []))
      .catch(() => setProducts([]));
  }, []);

  const dateLabels = useMemo(
    () => ({
      open: t("access_date_open"),
      clear: t("access_deadline_clear"),
      today: t("access_date_today"),
      placeholder: t("access_date_placeholder"),
    }),
    [t],
  );

  // The product's own price is the starting figure; the operator may change it.
  const pick = (code: string) => {
    setProduct(code);
    const offer = products.find((row) => row.code === code)?.offer;
    if (offer?.amount) {
      setAmount(String(offer.amount));
      if (offer.currency) setCurrency(offer.currency);
    }
  };

  const hasContact = Boolean(customerId || email.trim() || phone.trim());
  const hasProduct = product === OTHER ? Boolean(otherTitle.trim()) : Boolean(product);
  const ready = hasContact && hasProduct && Number(amount) > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const sale = await authorizedJson<{ customerId: string }>("/api/admin/customers/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId ?? null,
          name: customerId ? null : name,
          email: customerId ? null : email,
          phone: customerId ? null : phone,
          productCode: product === OTHER ? null : product,
          otherTitle: product === OTHER ? otherTitle : null,
          amount: Number(amount),
          currency,
          paidOn: paidOn || null,
          note,
        }),
      });
      onSaved(sale);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AdminModal
      title={t("customers_sale_title")}
      description={t("customers_sale_hint")}
      size="lg"
      onClose={onClose}
      closeLabel={t("common_close")}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${controls.action} cw-btn-muted`}>
            {t("customers_sale_cancel")}
          </button>
          <button type="button" onClick={submit} disabled={!ready} className={`${controls.action} cw-btn-primary`}>
            {t("customers_sale_submit")}
          </button>
        </>
      }
    >
      <div className={access.stack}>
        {!customerId && (
          <div className={access.stack}>
            <span className={access.cap}>{t("customers_sale_who")}</span>
            <div className={access.grantMore}>
              <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                <span className={controls.fieldCaption}>{t("customers_sale_name")}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={controls.input} />
              </label>
              <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                <span className={controls.fieldCaption}>{t("customers_sale_email")}</span>
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={controls.input}
                />
              </label>
              <label className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
                <span className={controls.fieldCaption}>{t("customers_sale_phone")}</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={controls.input}
                />
              </label>
            </div>
            <p className={controls.hint}>{t("customers_sale_contact_hint")}</p>
          </div>
        )}

        <div className={access.grantMore}>
          <label className={`${controls.field} ${access.spanFull} ${access.spanNote}`}>
            <span className={controls.fieldCaption}>{t("customers_sale_product")}</span>
            <select value={product} onChange={(e) => pick(e.target.value)} className={controls.select}>
              <option value="" disabled>
                —
              </option>
              {products.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.title}
                </option>
              ))}
              <option value={OTHER}>{t("customers_sale_product_other")}</option>
            </select>
          </label>
          {product === OTHER && (
            <label className={`${controls.field} ${access.spanFull} ${access.spanNote}`}>
              <span className={controls.fieldCaption}>{t("customers_sale_product_title")}</span>
              <input value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} className={controls.input} />
            </label>
          )}
          <label className={`${controls.field} ${access.spanAmount}`}>
            <span className={controls.fieldCaption}>{t("customers_sale_amount")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={controls.input}
            />
          </label>
          <label className={`${controls.field} ${access.spanCurrency}`}>
            <span className={controls.fieldCaption}>{t("customers_sale_currency")}</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={controls.select}>
              {PAYMENT_CURRENCIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className={`${controls.field} ${access.spanFull} ${access.spanCourse}`}>
            <span className={controls.fieldCaption}>{t("customers_sale_paid_on")}</span>
            <AdminDateField value={paidOn} onChange={setPaidOn} locale={locale} labels={dateLabels} />
          </div>
          <label className={`${controls.field} ${access.spanFull} ${access.spanNote}`}>
            <span className={controls.fieldCaption}>{t("customers_sale_note")}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={controls.input} />
          </label>
        </div>

        {error && (
          <p className={controls.hint} role="alert">
            {t("customers_sale_failed")}: {error}
          </p>
        )}
      </div>
    </AdminModal>
  );
}
