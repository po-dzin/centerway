"use client";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";

interface AdminSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onClear?: () => void;
  className?: string;
}

export function AdminSearchInput({ value, onChange, placeholder, onClear, className = "" }: AdminSearchInputProps) {
  const { t } = useI18n();

  return (
    <div className={`relative ${className}`.trim()}>
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none cw-muted">
        <Icon name="lens" size={16} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="cw-input w-full pl-10 pr-10 py-2.5 text-sm"
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          /* The only control on this input with no visible text: without a name
             a screen reader reads it as "button" and its whole job — undoing
             the search that is filtering the table — is unreadable. */
          aria-label={t("common_clear_search")}
          title={t("common_clear_search")}
          className="absolute inset-y-0 right-3 flex items-center cw-link-hover"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
