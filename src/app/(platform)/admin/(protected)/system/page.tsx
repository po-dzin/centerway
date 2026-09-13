"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import page from "@/components/admin/AdminPage.module.css";
import surfaces from "@/components/admin/AdminSurfaces.module.css";

export default function AdminSystemPage() {
  const { t } = useI18n();

  return (
    <div className={page.page}>
      <div className={page.heading}>
        <h2 className={page.title}>{t("system_title")}</h2>
        <p className={page.subtitle}>{t("system_subtitle")}</p>
      </div>

      <div className={page.cards}>
        <Link href="/admin/system/audit" className={`${surfaces.plate} ${page.cardLink}`}>
          <p className={page.cardLabel}>{t("system_card_audit_label")}</p>
          <p className={page.cardTitle}>{t("system_card_audit_title")}</p>
          <p className={page.cardText}>{t("system_card_audit_desc")}</p>
        </Link>

        <div className={`${surfaces.plate} ${page.cardStatic}`}>
          <p className={page.cardLabel}>{t("system_card_integrations_label")}</p>
          <p className={page.cardTitle}>{t("system_card_integrations_title")}</p>
          <p className={page.cardText}>{t("system_card_integrations_desc")}</p>
        </div>
      </div>
    </div>
  );
}
