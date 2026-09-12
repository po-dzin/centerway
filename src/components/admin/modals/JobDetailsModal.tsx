"use client";

import { useState } from "react";
import { JOB_STATUS_BADGE_CLASS } from "@/lib/admin/adminStatusStyles";
import { useToast } from "@/components/ToastProvider";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { AdminModal } from "@/components/admin/AdminModal";
import controls from "@/components/admin/AdminControls.module.css";

interface Job {
  id: string;
  type: string;
  payload: unknown;
  status: "pending" | "running" | "success" | "failed";
  error_text: string | null;
  attempts: number;
}

export function JobDetailsModal({
  job,
  onClose,
  onRetry,
  labels,
  statusLabels,
}: {
  job: Job;
  onClose: () => void;
  onRetry: () => void;
  labels: {
    retryError: string;
    retrySuccess: string;
    details: string;
    type: string;
    status: string;
    attempts: string;
    payload: string;
    error: string;
    retry: string;
  };
  statusLabels: Record<Job["status"], string>;
}) {
  const [retrying, setRetrying] = useState(false);
  const toast = useToast();

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await authorizedFetch(`/api/admin/jobs/${job.id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error(labels.retryError);
      toast.success(labels.retrySuccess);
      onRetry();
    } catch (err) {
      console.error(err);
      toast.error(labels.retryError);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <AdminModal
      title={labels.details}
      description={job.id}
      onClose={onClose}
      size="lg"
      footer={
        job.status === "failed" ? (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className={`${controls.action} cw-btn-status-running`}
          >
            {/* IN FLIGHT, IN WORDS (2026-09-06). This was a 14px rotating ring
                — too small for the house mark to stand in (`LogoMark` refuses
                below 20px, and rightly), and the fourth spinner in a product
                that had decided against them. It needs no glyph: the button is
                already disabled and dimmed while the request is out, and the
                ellipsis is how every other control here says «doing it» —
                «Зберігаємо…» in the workshop, «Надсилаємо…» in the cabinet. */}
            {retrying ? `${labels.retry}…` : labels.retry}
          </button>
        ) : null
      }
    >
      <div className={controls.facts}>
        <div className={controls.factRow}>
          <span className={controls.factLabel}>{labels.type}</span>
          <span className={`${controls.factValue} ${controls.mono}`}>{job.type}</span>
        </div>
        <div className={controls.factRow}>
          <span className={controls.factLabel}>{labels.status}</span>
          <span className={JOB_STATUS_BADGE_CLASS[job.status]}>{statusLabels[job.status]}</span>
        </div>
        <div className={controls.factRow}>
          <span className={controls.factLabel}>{labels.attempts}</span>
          <span className={controls.factValue}>{job.attempts}</span>
        </div>
      </div>

      <div>
        <span className={controls.fieldLabel}>{labels.payload}</span>
        <pre className={controls.code}>{JSON.stringify(job.payload, null, 2)}</pre>
      </div>

      {job.error_text ? (
        <div>
          <span className={controls.fieldLabel}>{labels.error}</span>
          <pre className={controls.codeFailed}>{job.error_text}</pre>
        </div>
      ) : null}
    </AdminModal>
  );
}
