"use client";

import type { ReactNode } from "react";

interface AdminEmptyStateProps {
    icon: ReactNode;
    description: ReactNode;
    title?: ReactNode;
    className?: string;
    iconWrapperClassName?: string;
}

export function AdminEmptyState({
    icon,
    description,
    title,
    className = "",
    iconWrapperClassName = "w-12 h-12 rounded-2xl",
}: AdminEmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center text-center cw-empty-state ${className}`.trim()}>
            <div className={`${iconWrapperClassName} cw-empty-icon flex items-center justify-center mb-4`.trim()}>
                {icon}
            </div>
            {title ? <h3 className="text-sm font-medium cw-text">{title}</h3> : null}
            <p className={`text-sm cw-muted ${title ? "mt-1 max-w-xs" : ""}`.trim()}>
                {description}
            </p>
        </div>
    );
}
