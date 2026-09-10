"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

export default function AdminSystemPage() {
    const { t } = useI18n();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="cw-page-title mb-1">{t("system_title")}</h2>
                <p className="cw-page-subtitle">{t("system_subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                    href="/admin/system/audit"
                    className="cw-panel p-5 hover:bg-[var(--cw-surface-2)] transition-colors"
                >
                    <p className="text-sm cw-muted">{t("system_card_audit_label")}</p>
                    <p className="text-lg font-semibold cw-text mt-1">{t("system_card_audit_title")}</p>
                    <p className="text-sm cw-muted mt-2">{t("system_card_audit_desc")}</p>
                </Link>

                <div className="cw-panel p-5">
                    <p className="text-sm cw-muted">{t("system_card_integrations_label")}</p>
                    <p className="text-lg font-semibold cw-text mt-1">{t("system_card_integrations_title")}</p>
                    <p className="text-sm cw-muted mt-2">{t("system_card_integrations_desc")}</p>
                </div>
            </div>
        </div>
    );
}
