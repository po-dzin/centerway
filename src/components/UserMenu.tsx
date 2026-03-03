"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

interface UserMenuProps {
    email?: string | null;
    initial?: string;
    avatarUrl?: string | null;
}

export function UserMenu({ email, initial = "?", avatarUrl }: UserMenuProps) {
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
                className="w-8 h-8 bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-white rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-neutral-300 dark:ring-neutral-700 hover:ring-2 hover:ring-neutral-400 dark:hover:ring-neutral-500 transition-all overflow-hidden"
                title={email ?? ""}
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt={email ?? "User avatar"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    initial
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl dark:shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {email && (
                        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{email}</p>
                        </div>
                    )}
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        Выйти
                    </button>
                </div>
            )}
        </div>
    );
}
