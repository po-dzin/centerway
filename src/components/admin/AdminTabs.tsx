"use client";

import { useEffect, useRef } from "react";

import { InteractionInkLabel } from "@/components/platform/InteractionInk";

interface TabItem {
    key: string;
    label: string;
}

interface AdminTabsProps {
    items: TabItem[];
    activeKey: string;
    onChange: (key: string) => void;
    className?: string;
}

/** How long the rail stays lit after the last scroll event — long enough that
 *  one flick's worth of momentum doesn't flash it on and off, short enough
 *  that it still reads as "while moving" rather than "for a while after". */
const SCROLL_INDICATOR_HOLD_MS = 500;

export function AdminTabs({ items, activeKey, onChange, className = "" }: AdminTabsProps) {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const bar = barRef.current;
        if (!bar) return;

        let hideTimer: ReturnType<typeof setTimeout> | undefined;
        const onScroll = () => {
            bar.dataset.scrolling = "true";
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                delete bar.dataset.scrolling;
            }, SCROLL_INDICATOR_HOLD_MS);
        };

        bar.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            bar.removeEventListener("scroll", onScroll);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, []);

    return (
        <div ref={barRef} className={`cw-tabbar overflow-x-auto overflow-y-hidden ${className}`.trim()}>
            {items.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    onClick={() => onChange(tab.key)}
                    className={`cw-tab ${activeKey === tab.key ? "cw-tab-active" : ""}`}
                    aria-pressed={activeKey === tab.key}
                >
                    <InteractionInkLabel>{tab.label}</InteractionInkLabel>
                </button>
            ))}
        </div>
    );
}
