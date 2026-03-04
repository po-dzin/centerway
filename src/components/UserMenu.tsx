"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";

interface UserMenuProps {
    email?: string | null;
    initial?: string;
    avatarUrl?: string | null;
}

export function UserMenu({ email, initial = "?", avatarUrl }: UserMenuProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSignOut = async () => {
        setOpen(false);
        await supabaseClient.auth.signOut();
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-8 h-8 cw-surface-2 cw-text rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-[var(--cw-border)] hover:ring-2 hover:ring-[var(--cw-border)] transition-all overflow-hidden"
                title={email ?? ""}
            >
                {avatarUrl ? (
                    <Image
                        src={avatarUrl}
                        alt={email ?? "User avatar"}
                        width={32}
                        height={32}
                        unoptimized
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    initial
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-52 cw-surface border cw-border rounded-xl cw-shadow overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {email && (
                        <div className="px-4 py-3 border-b cw-border">
                            <p className="text-xs cw-muted truncate">{email}</p>
                        </div>
                    )}
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm cw-text hover:bg-[var(--cw-surface-2)] transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        {t("dashboard_signout")}
                    </button>
                </div>
            )}
        </div>
    );
}
