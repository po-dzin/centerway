"use client";

import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";

interface AdminPaginationProps {
    page: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
}

export function AdminPagination({ page, totalPages, onPrev, onNext }: AdminPaginationProps) {
    const { t } = useI18n();

    if (totalPages <= 1) return null;

    const scrollAdminViewportToTop = () => {
        if (typeof document === "undefined") return;
        const viewport = document.querySelector<HTMLElement>("[data-admin-scroll]");
        if (viewport) {
            viewport.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handlePrev = () => {
        onPrev();
        scrollAdminViewportToTop();
    };

    const handleNext = () => {
        onNext();
        scrollAdminViewportToTop();
    };

    return (
        <div className="cw-pagination">
            <button
                type="button"
                onClick={handlePrev}
                disabled={page === 0}
                className="cw-page-btn"
                title={t("common_prev")}
            >
                <InteractionInkIcon><Icon name="arrow-left" size={20} /></InteractionInkIcon>
            </button>

            <div className="cw-page-subtitle">
                {t("common_page")} <span className="font-medium cw-text">{page + 1}</span> {t("common_of")} <span className="font-medium cw-text">{totalPages}</span>
            </div>

            <button
                type="button"
                onClick={handleNext}
                disabled={page >= totalPages - 1}
                className="cw-page-btn"
                title={t("common_next")}
            >
                <InteractionInkIcon><Icon name="chevron-right" size={20} /></InteractionInkIcon>
            </button>
        </div>
    );
}
