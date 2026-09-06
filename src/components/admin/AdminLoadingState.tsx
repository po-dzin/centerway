"use client";

import { LogoMark } from "@/components/brand/LogoMark";

interface AdminLoadingStateProps {
    variant: "skeleton" | "spinner";
    rows?: number;
    rowClassName?: string;
    text?: string;
    className?: string;
}

export function AdminLoadingState({
    variant,
    rows = 5,
    rowClassName = "h-16",
    text,
    className = "",
}: AdminLoadingStateProps) {
    if (variant === "spinner") {
        return (
            <div className={`py-20 flex flex-col items-center justify-center space-y-4 ${className}`.trim()}>
                {/* THE HOUSE MARK WAITS (2026-09-06). This was a rotating ring
                    drawn from Tailwind's `animate-spin` — a glyph from no design
                    system in particular, and the one waiting state in the
                    product that said «something is happening» without saying
                    what. `LogoMark`'s `wait` has been the answer since it was
                    written («the spinner replacement», in its own source), and
                    the panel's own words below say the rest.

                    A COMPONENT, not a token: the panel runs its own grey
                    Tailwind skin and `--ds-*` may not be pulled into it, but
                    React components cross that line all day — this file's
                    neighbours already mount the platform's account menu, its
                    chrome and its ink labels. */}
                <LogoMark size={32} animate="wait" aria-hidden="true" />
                {text ? <span className="text-sm font-medium cw-muted">{text}</span> : null}
            </div>
        );
    }

    return (
        <div className={`space-y-2 ${className}`.trim()}>
            {[...Array(rows)].map((_, i) => (
                <div key={i} className={`${rowClassName} cw-skeleton-row`} />
            ))}
        </div>
    );
}
