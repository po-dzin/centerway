"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { JobDetailsModal } from "@/components/admin/modals/JobDetailsModal";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { JOB_STATUS_BADGE_CLASS } from "@/lib/admin/adminStatusStyles";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import type { JobListItem as Job, JobsPage } from "@/lib/admin/jobs";
import { Icon } from "@/components/Icon";
import pageStyles from "@/components/admin/AdminPage.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";

/** Same shape as CustomersList: the first page arrives as a prop, the rest via the API. */
export function JobsList({ initial }: { initial: JobsPage }) {
  const { lang, t } = useI18n();
  const locale = getAdminLocale(lang);
  const statusLabels: Record<Job["status"], string> = {
    pending: t("jobs_status_pending"),
    running: t("jobs_status_running"),
    success: t("jobs_status_success"),
    failed: t("jobs_status_failed"),
  };
  const STATUS_TABS = [
    { key: "", label: t("jobs_tab_all") },
    { key: "pending", label: t("jobs_tab_pending") },
    { key: "running", label: t("jobs_tab_running") },
    { key: "success", label: t("jobs_tab_success") },
    { key: "failed", label: t("jobs_tab_failed") },
  ];
  const modalLabels = {
    retryError: t("jobs_retry_error"),
    retrySuccess: t("jobs_retry_success"),
    details: t("jobs_details"),
    type: t("jobs_type"),
    status: t("jobs_status"),
    attempts: t("jobs_attempts"),
    payload: t("jobs_payload"),
    error: t("jobs_error"),
    retry: t("jobs_retry"),
  };

  const [q, setQ] = useState("");
  const [debouncedQ, setDQ] = useState("");
  const [activeStatus, setStatus] = useState("");
  const [data, setData] = useState<Job[]>(initial.data);
  const [count, setCount] = useState(initial.count);
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDQ(q);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchJobs = useCallback(async (query: string, status: string, pageIndex: number) => {
    requestSeq.current += 1;
    const reqId = requestSeq.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setData([]);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      params.set("limit", String(LIMIT));
      params.set("offset", String(pageIndex * LIMIT));

      const res = await authorizedFetch(`/api/admin/jobs?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (reqId !== requestSeq.current) return;

      setData(json.data ?? []);
      setCount(json.count ?? 0);
    } catch (e: unknown) {
      if (ctrl.signal.aborted) return;
      if (reqId !== requestSeq.current) return;
      setError(getErrorMessage(e));
    } finally {
      if (reqId !== requestSeq.current) return;
      setLoading(false);
    }
  }, []);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    fetchJobs(debouncedQ, activeStatus, page);
  }, [debouncedQ, activeStatus, page, fetchJobs]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleStatusChange = (status: string) => {
    setStatus(status);
    setPage(0);
  };

  const totalPages = Math.ceil(count / LIMIT);

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.heading}>
        <h2 className={pageStyles.title}>{t("jobs_title")}</h2>
        <p className={pageStyles.subtitle}>{t("jobs_subtitle")}</p>
      </div>

      {/* Status tabs */}
      <AdminTabs items={STATUS_TABS} activeKey={activeStatus} onChange={handleStatusChange} />

      <AdminSearchInput
        value={q}
        onChange={setQ}
        placeholder={t("jobs_search_placeholder")}
        onClear={q ? () => setQ("") : undefined}
      />

      {loading ? (
        <AdminLoadingState variant="spinner" text={t("jobs_loading")} />
      ) : error ? (
        <AdminErrorState
          title={t("common_error")}
          message={error}
          action={
            <button
              type="button"
              onClick={() => fetchJobs(debouncedQ, activeStatus, page)}
              className={`${controls.action} cw-surface-2`}
            >
              {t("analytics_retry")}
            </button>
          }
        />
      ) : data.length === 0 ? (
        <AdminEmptyState
          icon={<Icon className="cw-muted" name="clock" size={20} />}
          title={t("jobs_not_found")}
          description={q || activeStatus ? t("jobs_try_filters") : t("jobs_queue_empty")}
        />
      ) : (
        <div className={lists.list}>
          {data.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setSelectedJob(job)}
              className={lists.itemPress}
              title={t("jobs_details")}
            >
              <div className={lists.statusDisc}>
                <span
                  className={`${job.status === "running" ? lists.statusDotLive : lists.statusDot} ${
                    job.status === "success"
                      ? "cw-status-success-dot"
                      : job.status === "failed"
                        ? "cw-status-failed-dot"
                        : job.status === "running"
                          ? "cw-status-running-dot"
                          : "cw-status-pending-dot"
                  }`}
                />
              </div>

              <div className={lists.itemBody}>
                <div className={lists.itemTitleRow}>
                  <p className={lists.itemTypeCode}>{job.type}</p>
                  <span className={JOB_STATUS_BADGE_CLASS[job.status]}>{statusLabels[job.status]}</span>
                </div>
                <div className={lists.itemMeta}>
                  <span className={lists.itemIdFaint}>{job.id}</span>
                  {job.status === "failed" && job.error_text && (
                    <span className={lists.itemError}>{job.error_text}</span>
                  )}
                </div>
              </div>

              <div className={lists.itemWhen}>
                <p className={lists.itemWhenTime}>
                  {new Date(job.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className={lists.itemWhenDate}>
                  {new Date(job.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && count > 0 && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      )}

      {/* Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          labels={modalLabels}
          statusLabels={statusLabels}
          onClose={() => setSelectedJob(null)}
          onRetry={() => {
            setSelectedJob(null);
            fetchJobs(debouncedQ, activeStatus, page);
          }}
        />
      )}
    </div>
  );
}
