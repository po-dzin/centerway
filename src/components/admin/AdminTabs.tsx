"use client";

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

export function AdminTabs({ items, activeKey, onChange, className = "" }: AdminTabsProps) {
    return (
        <div className={`cw-tabbar overflow-x-auto overflow-y-hidden ${className}`.trim()}>
            {items.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    className={`cw-tab ${activeKey === tab.key ? "cw-tab-active" : ""}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
