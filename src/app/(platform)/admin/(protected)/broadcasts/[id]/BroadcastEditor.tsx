"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminModal } from "@/components/admin/AdminModal";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import controls from "@/components/admin/AdminControls.module.css";
import pageStyles from "@/components/admin/AdminPage.module.css";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import styles from "@/components/admin/AdminBroadcasts.module.css";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { normalizeAudience, type Audience, type AudienceKind, type AudienceRule } from "@/lib/broadcasts/audience";
import { renderBroadcastEmail } from "@/lib/broadcasts/render";
import type { AudienceOptions, Broadcast, BroadcastStats } from "@/lib/broadcasts/server";
import type { TranslationKey } from "@/lib/i18n";

import { BROADCAST_STATUS_BADGE_CLASS, BROADCAST_STATUS_LABEL, errorFromResponse, fill } from "../broadcastUi";

type Draft = Pick<Broadcast, "title" | "subject" | "preheader" | "body" | "cta_label" | "cta_url"> & {
  audience: Audience;
};

const EDITABLE = new Set(["draft", "scheduled", "cancelled", "failed"]);
const LIVE = new Set(["scheduled", "sending"]);

function draftOf(broadcast: Broadcast): Draft {
  return {
    title: broadcast.title,
    subject: broadcast.subject,
    preheader: broadcast.preheader,
    body: broadcast.body,
    cta_label: broadcast.cta_label,
    cta_url: broadcast.cta_url,
    audience: broadcast.audience,
  };
}

function comparable(draft: Draft): string {
  return JSON.stringify({
    ...draft,
    title: draft.title.trim(),
    subject: draft.subject.trim(),
    preheader: draft.preheader.trim(),
    cta_label: draft.cta_label?.trim() || null,
    cta_url: draft.cta_url?.trim() || null,
    audience: normalizeAudience(draft.audience),
  });
}

/** `datetime-local` wants local wall time without a zone. */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BroadcastEditor({
  initial,
  canWrite,
}: {
  initial: { broadcast: Broadcast; stats: BroadcastStats };
  canWrite: boolean;
}) {
  const { lang, t } = useI18n();
  const locale = getAdminLocale(lang);
  const toast = useToast();
  const router = useRouter();

  const [saved, setSaved] = useState<Broadcast>(initial.broadcast);
  const [stats, setStats] = useState<BroadcastStats>(initial.stats);
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial.broadcast));
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [previewName, setPreviewName] = useState("Анна");
  const [scheduleAt, setScheduleAt] = useState(() => localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [confirm, setConfirm] = useState<null | "now" | "schedule">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editable = canWrite && EDITABLE.has(saved.status);
  const dirty = comparable(draft) !== comparable(draftOf(saved));
  const normalizedAudience = useMemo(() => normalizeAudience(draft.audience), [draft.audience]);
  const audienceKey = JSON.stringify(normalizedAudience);

  useEffect(() => {
    let cancelled = false;
    authorizedFetch("/api/admin/broadcasts/audience")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: AudienceOptions | null) => {
        if (!cancelled && json) setOptions(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The live count, suppression applied, debounced so typing a tag is one query.
  useEffect(() => {
    const audience = JSON.parse(audienceKey) as Audience;
    if (audience.include.length === 0) {
      setCount(0);
      return;
    }
    setCounting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await authorizedFetch("/api/admin/broadcasts/audience", {
          method: "POST",
          body: JSON.stringify({ audience }),
        });
        const json = res.ok ? ((await res.json()) as { count: number }) : null;
        setCount(json?.count ?? null);
      } finally {
        setCounting(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [audienceKey]);

  const refresh = useCallback(async () => {
    const res = await authorizedFetch(`/api/admin/broadcasts/${saved.id}`);
    if (!res.ok) return;
    const json = (await res.json()) as { broadcast: Broadcast; stats: BroadcastStats };
    setSaved(json.broadcast);
    setStats(json.stats);
  }, [saved.id]);

  // Progress while it goes out; an edit in progress is never overwritten — only
  // `saved` and the counters move.
  useEffect(() => {
    if (!LIVE.has(saved.status)) return;
    const timer = setInterval(refresh, saved.status === "sending" ? 4000 : 15000);
    return () => clearInterval(timer);
  }, [saved.status, refresh]);

  const save = async (): Promise<boolean> => {
    if (!dirty) return true;
    setBusy(true);
    try {
      const res = await authorizedFetch(`/api/admin/broadcasts/${saved.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...draft, audience: normalizedAudience }),
      });
      if (!res.ok) {
        toast.error(await errorFromResponse(res, t));
        return false;
      }
      const { broadcast } = (await res.json()) as { broadcast: Broadcast };
      setSaved(broadcast);
      setDraft(draftOf(broadcast));
      return true;
    } finally {
      setBusy(false);
    }
  };

  const post = async (path: string, body: unknown = {}) => {
    setBusy(true);
    try {
      const res = await authorizedFetch(`/api/admin/broadcasts/${saved.id}/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(await errorFromResponse(res, t));
        return null;
      }
      return (await res.json()) as Record<string, unknown>;
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!(await save())) return;
    const result = await post("test");
    if (result) toast.success(fill(t("broadcasts_test_sent"), { email: String(result.to) }));
  };

  const send = async (mode: "now" | "schedule") => {
    setConfirm(null);
    if (!(await save())) return;
    const at = mode === "schedule" ? new Date(scheduleAt).toISOString() : undefined;
    const result = await post("send", at ? { at } : {});
    if (!result) return;
    toast.success(t("broadcasts_queued"));
    await refresh();
  };

  const cancel = async () => {
    const result = await post("cancel");
    if (!result) return;
    toast.info(t("broadcasts_cancelled"));
    await refresh();
  };

  const remove = async () => {
    setConfirmDelete(false);
    setBusy(true);
    try {
      const res = await authorizedFetch(`/api/admin/broadcasts/${saved.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(await errorFromResponse(res, t));
        return;
      }
      router.push("/admin/broadcasts");
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // ── audience editing ──────────────────────────────────────────────────
  const rule = <K extends AudienceKind>(kind: K) =>
    draft.audience.include.find((r): r is Extract<AudienceRule, { kind: K }> => r.kind === kind);

  const toggleKind = (kind: AudienceKind, on: boolean) =>
    setDraft((d) => {
      const rest = d.audience.include.filter((r) => r.kind !== kind);
      const added: AudienceRule = kind === "tag" ? { kind: "tag", tags: [] } : ({ kind } as AudienceRule);
      return { ...d, audience: { ...d.audience, include: on ? [...rest, added] : rest } };
    });

  const toggleValue = (kind: AudienceKind, field: string, value: string, on: boolean) =>
    setDraft((d) => ({
      ...d,
      audience: {
        ...d.audience,
        include: d.audience.include.map((r) => {
          if (r.kind !== kind) return r;
          const current = ((r as Record<string, unknown>)[field] as string[] | undefined) ?? [];
          const next = on ? [...new Set([...current, value])] : current.filter((v) => v !== value);
          return { ...r, [field]: next } as AudienceRule;
        }),
      },
    }));

  const toggleExclude = (tag: string, on: boolean) =>
    setDraft((d) => {
      const current = d.audience.exclude_tags ?? [];
      const next = on ? [...new Set([...current, tag])] : current.filter((v) => v !== tag);
      return { ...d, audience: { ...d.audience, exclude_tags: next } };
    });

  const valuesOf = (kind: AudienceKind, field: string): string[] =>
    ((rule(kind) as Record<string, unknown> | undefined)?.[field] as string[] | undefined) ?? [];

  const optionList = (
    kind: AudienceKind,
    field: string,
    items: { value: string; label: string; count?: number }[],
  ) =>
    rule(kind) ? (
      <div className={styles.options}>
        {items.length === 0 ? <span className={styles.checkHint}>{t("broadcasts_no_options")}</span> : null}
        {kind !== "tag" && items.length > 0 && valuesOf(kind, field).length === 0 ? (
          <span className={styles.checkHint}>{t("broadcasts_audience_any")}</span>
        ) : null}
        {items.map((item) => (
          <label key={item.value} className={styles.check}>
            <input
              type="checkbox"
              disabled={!editable}
              checked={valuesOf(kind, field).includes(item.value)}
              onChange={(e) => toggleValue(kind, field, item.value, e.target.checked)}
            />
            <span>
              {item.label} {item.count !== undefined ? <span className={styles.optionCount}>{item.count}</span> : null}
            </span>
          </label>
        ))}
      </div>
    ) : null;

  const group = (kind: AudienceKind, label: TranslationKey, hint: TranslationKey | null, children: React.ReactNode) => (
    <div className={styles.group}>
      <label className={styles.check}>
        <input
          type="checkbox"
          disabled={!editable}
          checked={Boolean(rule(kind))}
          onChange={(e) => toggleKind(kind, e.target.checked)}
        />
        <span className={styles.checkLabel}>
          <span>{t(label)}</span>
          {hint ? <span className={styles.checkHint}>{t(hint)}</span> : null}
        </span>
      </label>
      {children}
    </div>
  );

  // ── preview ───────────────────────────────────────────────────────────
  const preview = useMemo(
    () =>
      renderBroadcastEmail(
        {
          subject: draft.subject,
          preheader: draft.preheader,
          body: draft.body,
          ctaLabel: draft.cta_label,
          ctaUrl: draft.cta_url,
        },
        { name: previewName, unsubscribeUrl: "#" },
      ),
    [draft.subject, draft.preheader, draft.body, draft.cta_label, draft.cta_url, previewName],
  );
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;background:#fff">${preview.html}</body></html>`;

  const products = (options?.products ?? []).map((p) => ({ value: p.code, label: p.label }));
  const statTiles: [TranslationKey, number][] = [
    ["broadcasts_stat_total", stats.total],
    ["broadcasts_stat_sent", stats.sent],
    ["broadcasts_stat_pending", stats.pending],
    ["broadcasts_stat_failed", stats.failed],
    ["broadcasts_stat_delivered", stats.delivered],
    ["broadcasts_stat_opened", stats.opened],
    ["broadcasts_stat_clicked", stats.clicked],
    ["broadcasts_stat_unsubscribed", stats.unsubscribed],
    ["broadcasts_stat_bounced", stats.bounced],
    ["broadcasts_stat_complained", stats.complained],
  ];

  return (
    <div className={pageStyles.page}>
      <Link href="/admin/broadcasts" className={styles.back}>
        <Icon name="arrow-left" size={14} />
        {t("broadcasts_back")}
      </Link>

      <div className={styles.toolbar}>
        <div className={pageStyles.heading}>
          <h2 className={pageStyles.title}>{saved.title || saved.subject || t("broadcasts_untitled")}</h2>
          <p className={pageStyles.subtitle}>
            <span className={BROADCAST_STATUS_BADGE_CLASS[saved.status]}>{t(BROADCAST_STATUS_LABEL[saved.status])}</span>
            {saved.status === "scheduled" && saved.scheduled_at
              ? ` ${new Date(saved.scheduled_at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : null}
            {editable ? ` · ${dirty ? t("broadcasts_unsaved") : t("broadcasts_saved")}` : null}
          </p>
        </div>
        {editable ? (
          <div className={controls.actions}>
            {saved.status === "draft" ? (
              <button type="button" className={`${controls.action} cw-btn-muted`} disabled={busy} onClick={() => setConfirmDelete(true)}>
                {t("broadcasts_delete")}
              </button>
            ) : null}
            <button type="button" className={`${controls.action} cw-surface-2`} disabled={busy || !dirty} onClick={save}>
              {t("broadcasts_save")}
            </button>
          </div>
        ) : null}
      </div>

      {saved.error_text ? <p className={controls.dialogError}>{saved.error_text}</p> : null}
      {!editable && canWrite ? <p className={controls.hint}>{t("broadcasts_readonly")}</p> : null}
      {!canWrite ? <p className={controls.hint}>{t("broadcasts_role_admin_only")}</p> : null}

      {saved.status !== "draft" ? (
        <section className={`${surfaces.plate} ${surfaces.plateCard} ${styles.section}`}>
          <h3 className={styles.sectionTitle}>{t("broadcasts_section_stats")}</h3>
          <div className={styles.stats}>
            {statTiles.map(([label, value]) => (
              <div key={label} className={styles.stat}>
                <span className={styles.statValue}>{value}</span>
                <span className={styles.statLabel}>{t(label)}</span>
              </div>
            ))}
          </div>
          <p className={controls.hint}>{t("broadcasts_stats_note")}</p>
          {canWrite && LIVE.has(saved.status) ? (
            <div className={controls.actions}>
              <button type="button" className={`${controls.action} cw-surface-2`} disabled={busy} onClick={cancel}>
                {t("broadcasts_cancel")}
              </button>
            </div>
          ) : null}
          {canWrite && (saved.status === "cancelled" || saved.status === "failed") ? (
            <p className={controls.hint}>{t("broadcasts_back_to_draft_hint")}</p>
          ) : null}
        </section>
      ) : null}

      <div className={styles.editor}>
        <div className={styles.section}>
          <section className={`${surfaces.plate} ${surfaces.plateCard} ${styles.section}`}>
            <h3 className={styles.sectionTitle}>{t("broadcasts_section_content")}</h3>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("broadcasts_field_title")}</span>
              <input className={controls.input} disabled={!editable} value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("broadcasts_field_subject")}</span>
              <input className={controls.input} disabled={!editable} value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
            </label>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("broadcasts_field_preheader")}</span>
              <input className={controls.input} disabled={!editable} value={draft.preheader} onChange={(e) => set("preheader", e.target.value)} />
            </label>
            <label className={controls.field}>
              <span className={controls.fieldCaption}>{t("broadcasts_field_body")}</span>
              <textarea className={styles.body} disabled={!editable} value={draft.body} onChange={(e) => set("body", e.target.value)} />
            </label>
            <p className={controls.hint}>{t("broadcasts_body_hint")}</p>
            <div className={styles.twoFields}>
              <label className={controls.field}>
                <span className={controls.fieldCaption}>{t("broadcasts_field_cta_label")}</span>
                <input
                  className={controls.input}
                  disabled={!editable}
                  value={draft.cta_label ?? ""}
                  onChange={(e) => set("cta_label", e.target.value)}
                />
              </label>
              <label className={controls.field}>
                <span className={controls.fieldCaption}>{t("broadcasts_field_cta_url")}</span>
                <input
                  className={controls.input}
                  disabled={!editable}
                  inputMode="url"
                  placeholder="https://www.centerway.net.ua/…"
                  value={draft.cta_url ?? ""}
                  onChange={(e) => set("cta_url", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className={`${surfaces.plate} ${surfaces.plateCard} ${styles.section}`}>
            <div className={styles.toolbar}>
              <h3 className={styles.sectionTitle}>{t("broadcasts_section_audience")}</h3>
              <span className={styles.count}>
                {counting ? t("broadcasts_audience_counting") : fill(t("broadcasts_audience_count"), { count: count ?? "—" })}
              </span>
            </div>
            <p className={controls.hint}>{t("broadcasts_audience_hint")}</p>
            <div className={styles.groups}>
              {group(
                "subscribers",
                "broadcasts_kind_subscribers",
                "broadcasts_kind_subscribers_hint",
                optionList(
                  "subscribers",
                  "sources",
                  (options?.sources ?? []).map((s) => ({ value: s.source, label: s.source, count: s.count })),
                ),
              )}
              {group(
                "buyers",
                "broadcasts_kind_buyers",
                "broadcasts_kind_buyers_hint",
                optionList(
                  "buyers",
                  "product_codes",
                  (options?.products ?? []).filter((p) => p.paid > 0).map((p) => ({ value: p.code, label: p.label, count: p.paid })),
                ),
              )}
              {group(
                "enrolled",
                "broadcasts_kind_enrolled",
                "broadcasts_kind_enrolled_hint",
                optionList(
                  "enrolled",
                  "course_ids",
                  (options?.courses ?? []).map((c) => ({ value: c.id, label: c.title })),
                ),
              )}
              {group(
                "registered",
                "broadcasts_kind_registered",
                null,
                rule("registered") ? (
                  <div className={styles.options}>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={Boolean(rule("registered")?.opted_in_only)}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            audience: {
                              ...d.audience,
                              include: d.audience.include.map((r) =>
                                r.kind === "registered" ? { kind: "registered", opted_in_only: e.target.checked } : r,
                              ),
                            },
                          }))
                        }
                      />
                      <span>{t("broadcasts_kind_registered_opted")}</span>
                    </label>
                  </div>
                ) : null,
              )}
              {group(
                "leads",
                "broadcasts_kind_leads",
                "broadcasts_kind_leads_hint",
                optionList(
                  "leads",
                  "product_codes",
                  (options?.products ?? []).filter((p) => p.leads > 0).map((p) => ({ value: p.code, label: p.label, count: p.leads })),
                ),
              )}
              {group(
                "tag",
                "broadcasts_kind_tag",
                null,
                optionList(
                  "tag",
                  "tags",
                  (options?.tags ?? []).map((tag) => ({ value: tag.tag, label: tag.tag, count: tag.count })),
                ),
              )}
              {(options?.tags.length ?? 0) > 0 ? (
                <div className={styles.group}>
                  <span className={styles.checkLabel}>{t("broadcasts_exclude_tags")}</span>
                  <div className={styles.options}>
                    {(options?.tags ?? []).map((tag) => (
                      <label key={tag.tag} className={styles.check}>
                        <input
                          type="checkbox"
                          disabled={!editable}
                          checked={(draft.audience.exclude_tags ?? []).includes(tag.tag)}
                          onChange={(e) => toggleExclude(tag.tag, e.target.checked)}
                        />
                        <span>{tag.tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {products.length === 0 && !options ? <p className={controls.hint}>{t("broadcasts_audience_counting")}</p> : null}
          </section>

          {editable ? (
            <section className={`${surfaces.plate} ${surfaces.plateCard} ${styles.section}`}>
              <h3 className={styles.sectionTitle}>{t("broadcasts_section_send")}</h3>
              {options ? <p className={controls.hint}>{fill(t("broadcasts_sender"), { from: options.sender.from })}</p> : null}
              {options && !options.sender.dedicated ? <p className={controls.hint}>{t("broadcasts_sender_shared")}</p> : null}
              <div className={controls.actions}>
                <button type="button" className={`${controls.action} cw-surface-2`} disabled={busy} onClick={sendTest}>
                  {t("broadcasts_test")}
                </button>
              </div>
              <div className={controls.fields}>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("broadcasts_schedule_at")}</span>
                  <input
                    type="datetime-local"
                    className={controls.input}
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </label>
                <div className={controls.actions}>
                  <button
                    type="button"
                    className={`${controls.action} cw-surface-2`}
                    disabled={busy || !scheduleAt}
                    onClick={() => setConfirm("schedule")}
                  >
                    {t("broadcasts_schedule")}
                  </button>
                  <button
                    type="button"
                    className={`${controls.action} cw-btn-primary`}
                    disabled={busy || !count}
                    onClick={() => setConfirm("now")}
                  >
                    {t("broadcasts_send_now")}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className={styles.previewColumn}>
          <section className={`${surfaces.plate} ${surfaces.plateCard} ${styles.section}`}>
            <div className={styles.toolbar}>
              <h3 className={styles.sectionTitle}>{t("broadcasts_section_preview")}</h3>
              <label className={controls.field} style={{ flex: "0 1 12rem" }}>
                <span className={controls.fieldCaption}>{t("broadcasts_preview_name")}</span>
                <input className={controls.input} value={previewName} onChange={(e) => setPreviewName(e.target.value)} />
              </label>
            </div>
            <p className={styles.previewSubject}>{preview.subject || "—"}</p>
            {draft.preheader ? <p className={controls.hint}>{preview.text ? draft.preheader : null}</p> : null}
            <iframe title={t("broadcasts_section_preview")} className={styles.previewFrame} sandbox="" srcDoc={srcDoc} />
          </section>
        </div>
      </div>

      {confirm ? (
        <AdminModal
          title={t(confirm === "now" ? "broadcasts_confirm_title" : "broadcasts_confirm_schedule_title")}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className={controls.action} onClick={() => setConfirm(null)}>
                {t("common_close")}
              </button>
              <button type="button" className={`${controls.actionPrimary} cw-btn-primary`} disabled={busy} onClick={() => send(confirm)}>
                {t(confirm === "now" ? "broadcasts_confirm_go" : "broadcasts_confirm_schedule_go")}
              </button>
            </>
          }
        >
          <div className={controls.facts}>
            <div className={controls.factRow}>
              <span className={controls.factLabel}>{t("broadcasts_confirm_recipients")}</span>
              <span className={controls.factValue}>{count ?? "—"}</span>
            </div>
            <div className={controls.factRow}>
              <span className={controls.factLabel}>{t("broadcasts_confirm_subject")}</span>
              <span className={controls.factValue}>{draft.subject}</span>
            </div>
            <div className={controls.factRow}>
              <span className={controls.factLabel}>{t("broadcasts_confirm_when")}</span>
              <span className={controls.factValue}>
                {confirm === "now"
                  ? t("broadcasts_confirm_now")
                  : new Date(scheduleAt).toLocaleString(locale, { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <p className={controls.hint}>{t("broadcasts_confirm_note")}</p>
        </AdminModal>
      ) : null}

      {confirmDelete ? (
        <AdminModal
          title={t("broadcasts_delete")}
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button type="button" className={controls.action} onClick={() => setConfirmDelete(false)}>
                {t("common_close")}
              </button>
              <button type="button" className={`${controls.actionPrimary} cw-btn-muted`} disabled={busy} onClick={remove}>
                {t("broadcasts_delete")}
              </button>
            </>
          }
        >
          <p className={controls.confirmText}>{t("broadcasts_delete_confirm")}</p>
        </AdminModal>
      ) : null}
    </div>
  );
}
