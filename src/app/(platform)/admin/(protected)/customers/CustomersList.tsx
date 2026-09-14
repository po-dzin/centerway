"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/components/I18nProvider";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { LeadsPanel } from "@/components/admin/LeadsPanel";
import { getErrorMessage } from "@/lib/errors";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import type { CustomerListItem as Identity, CustomersPage } from "@/lib/admin/customers";
import { Icon } from "@/components/Icon";
import pageStyles from "@/components/admin/AdminPage.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";
import { StateBadge } from "@/components/platform/StateBadge";

function Avatar({ name, url }: { name?: string | null; url?: string | null }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? "?";
  return url ? (
    <Image
      src={url}
      alt={name ?? "avatar"}
      width={36}
      height={36}
      unoptimized
      className={lists.avatar}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className={lists.avatarFallback}>{initial}</div>
  );
}

/**
 * The list, with its first page already in hand: the server page read it and
 * passed it down, so the first paint is the data and not a skeleton. Every
 * later page and every search still goes through the API route; the list
 * skips only the fetch that would have repeated what it was given.
 */
export function CustomersList({ initial }: { initial: CustomersPage }) {
  const { lang, t } = useI18n();
  const isUk = lang === "uk";
  const locale = getAdminLocale(lang);
  /* TWO VIEWS OF THE SAME PEOPLE. A lead is now a `customers` row like any
     other — the form writes to the spine — so the request that produced it
     belongs beside the person, not in a section of its own. The nav stays at
     seven. */
  const [view, setView] = useState<"people" | "leads">("people");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<Identity[]>(initial.data);
  const [count, setCount] = useState(initial.count);
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0); // Reset page on query search
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchCustomers = useCallback(
    async (query: string, pageIndex: number) => {
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
        params.set("limit", String(LIMIT));
        params.set("offset", String(pageIndex * LIMIT));

        const url = `/api/admin/customers?${params}`;
        const res = await authorizedFetch(url, { signal: ctrl.signal });
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
    },
    [LIMIT],
  );

  const firstRun = useRef(true);
  useEffect(() => {
    // The mount's own values are the ones the server already answered.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    fetchCustomers(debouncedQ, page);
  }, [debouncedQ, page, fetchCustomers]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const getResultsLabel = (value: number) => {
    if (value === 0) return t("customers_results_none");
    if (!isUk)
      return `${value} ${value === 1 ? t("customers_results_record_one") : t("customers_results_record_many")}`;
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return `${value} ${t("customers_results_record_one")}`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
      return `${value} ${t("customers_results_record_few")}`;
    return `${value} ${t("customers_results_record_many")}`;
  };
  const querySuffix = (() => {
    if (!debouncedQ) return "";
    if (isUk) return ` ${t("customers_results_query_prefix")}«${debouncedQ}»`;
    return ` ${t("customers_results_query_prefix")}"${debouncedQ}"`;
  })();

  const totalPages = Math.ceil(count / LIMIT);

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.heading}>
        <h2 className={pageStyles.title}>{t("customers_title")}</h2>
        <p className={pageStyles.subtitle}>{t("customers_subtitle")}</p>
      </div>

      <AdminTabs
        items={[
          { key: "people", label: t("customers_tab_people") },
          { key: "leads", label: t("customers_tab_leads") },
        ]}
        activeKey={view}
        onChange={(key) => setView(key as "people" | "leads")}
      />

      {view === "leads" && <LeadsPanel />}

      {view === "people" && (
        <div className={pageStyles.section}>
          {/* Search bar */}
          <AdminSearchInput
            value={q}
            onChange={setQ}
            placeholder={t("customers_search_placeholder")}
            onClear={q ? () => setQ("") : undefined}
          />

          {/* Results header */}
          {!loading && (
            <p className={pageStyles.resultsNote}>
              {getResultsLabel(count)}
              {querySuffix}
            </p>
          )}

          {/* State: loading */}
          {loading && <AdminLoadingState variant="skeleton" rows={5} />}

          {/* State: error */}
          {error && !loading && (
            <AdminErrorState
              title={t("customers_loading_error")}
              message={error}
              action={
                <button
                  type="button"
                  onClick={() => fetchCustomers(debouncedQ, page)}
                  className={`${controls.action} cw-surface-2`}
                >
                  {t("analytics_retry")}
                </button>
              }
            />
          )}

          {/* State: empty */}
          {!loading && !error && data.length === 0 && (
            <AdminEmptyState
              icon={<Icon className="cw-muted" name="user" size={20} />}
              description={debouncedQ ? t("customers_not_found") : t("customers_empty")}
            />
          )}

          {/* Customer list */}
          {!loading && !error && data.length > 0 && (
            <div className={lists.list}>
              {data.map((identity) => (
                <Link key={identity.id} href={`/admin/customers/${identity.id}`} className={lists.itemPress}>
                  <Avatar name={identity.display_name ?? identity.email ?? identity.phone} url={identity.avatar_url} />

                  <div className={lists.itemBody}>
                    <p className={lists.itemTitle}>
                      {identity.display_name ?? identity.email ?? identity.phone ?? (
                        <span className={lists.itemTitleMissing}>{t("customers_no_name")}</span>
                      )}
                    </p>
                    {identity.matched_link ? (
                      <p className={lists.itemSub}>
                        <StateBadge>{identity.matched_link.type}</StateBadge> {identity.matched_link.value}
                      </p>
                    ) : (
                      <p className={lists.itemSub}>
                        {new Date(identity.created_at).toLocaleDateString(locale, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>

                  {identity.tags?.length > 0 && (
                    <div className={lists.chips}>
                      {identity.tags.slice(0, 3).map((tag) => (
                        <StateBadge key={tag}>{tag}</StateBadge>
                      ))}
                    </div>
                  )}

                  <Icon className={`cw-link-hover ${lists.itemEnd}`} name="chevron-right" size={16} />
                </Link>
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
        </div>
      )}
    </div>
  );
}
