"use client";

interface AdminSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    onClear?: () => void;
    className?: string;
}

export function AdminSearchInput({
    value,
    onChange,
    placeholder,
    onClear,
    className = "",
}: AdminSearchInputProps) {
    return (
        <div className={`relative ${className}`.trim()}>
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none cw-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="cw-input pl-10 pr-10 py-2.5 text-sm"
            />
            {onClear && value && (
                <button
                    type="button"
                    onClick={onClear}
                    className="absolute inset-y-0 right-3 flex items-center cw-link-hover"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    );
}
