"use client";

import type { ReactNode } from "react";

import surfaces from "@/components/admin/AdminSurfaces.module.css";
import { Icon } from "@/components/Icon";

interface AdminErrorStateProps {
  title: ReactNode;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function AdminErrorState({ title, message, action, className = "" }: AdminErrorStateProps) {
  return (
    <div className={`${surfaces.plate} ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-7 h-7 rounded-full cw-status-failed-soft-bg flex items-center justify-center">
          <Icon className="cw-status-failed-text" name="boundary" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold cw-text">{title}</p>
          <p className="text-sm cw-muted mt-1">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
