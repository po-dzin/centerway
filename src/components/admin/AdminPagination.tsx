"use client";

import { useI18n } from "@/components/I18nProvider";

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
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button>
        </div>
    );
}
