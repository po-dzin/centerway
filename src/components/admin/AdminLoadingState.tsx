"use client";

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
                <svg className="animate-spin cw-muted w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
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
