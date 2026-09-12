"use client";

import type { ReactNode } from "react";

import surfaces from "@/components/admin/AdminSurfaces.module.css";
import states from "@/components/admin/AdminStates.module.css";
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
      <div className={states.failure}>
        <div className={states.failureBadge}>
          <Icon className="cw-status-failed-text" name="boundary" size={16} />
        </div>
        <div className={states.failureBody}>
          <p className={states.failureTitle}>{title}</p>
          <p className={states.failureMessage}>{message}</p>
          {action ? <div className={states.failureAction}>{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
