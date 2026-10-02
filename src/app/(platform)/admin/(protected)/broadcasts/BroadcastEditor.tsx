"use client";

/**
 * One campaign: its words and its audience while it is a draft, its progress
 * once it is not.
 *
 * WHAT THE OWNER IS PROTECTED FROM, in the order it would go wrong:
 *   · sending to the wrong people — the count and a few addresses are on screen
 *     for every change of the rule, read from the same SQL the send freezes;
 *   · sending the wrong words — the preview is the renderer the sender uses,
 *     and «Тест собі» puts the real message in the owner's own inbox first;
 *   · sending by accident — the button opens a dialog that asks for the number
 *     of recipients typed back, and the server refuses if the audience changed
 *     in the meantime;
 *   · sending twice — the server turns a draft into `sending` once, and the
 *     batches it hands out are claimed with SKIP LOCKED.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminModal } from "@/components/admin/AdminModal";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import type { TranslationKey } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/errors";
import type { Audience, AudienceKind, AudienceRule } from "@/lib/broadcasts/audience";
import { renderBroadcast } from "@/lib/broadcasts/render";
import type { AudienceOptions, BroadcastDetail, BroadcastStats, SendProgress } from "@/lib/broadcasts/server";
import controls from "@/components/admin/AdminControls.module.css";
import pageStyles from "@/components/admin/AdminPage.module.css";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import bc from "@/components/admin/AdminBroadcasts.module.css";

async function call<T>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await authorizedFetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

function errorOf(data: unknown, status: number): string {
  const code = (data as { error?: unknown })?.error;
  return typeof code === "string" ? code : String(status);
}

function ruleOf<K extends AudienceKind>(audience: Audience, kind: K): Extract<AudienceRule, { kind: K }> | undefined {
  return audience.include.find((rule) => rule.kind === kind) as Extract<AudienceRule, { kind: K }> | undefined;
}

function withRule(audience: Audience, kind: AudienceKind, rule: AudienceRule | null): Audience {
  const include = audience.include.filter((r) => r.kind !== kind);
  return { ...audience, include: rule ? [...include, rule] : include };
}

function toggled(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/* The refusals an operator can do something about, in words; anything else is shown as its code. */
const ERROR_KEY: Record<string, TranslationKey> = {
  subject_required: "bc_err_subject_required",
  body_required: "bc_err_body_required",
  content_required: "bc_err_body_required",
  audience_required: "bc_err_audience_required",
  audience_empty: "bc_err_audience_required",
  ctaUrl_invalid: "bc_err_cta_url",
  broadcast_not_draft: "bc_err_not_draft",
  resend_not_configured: "bc_err_resend",
  test_send_failed: "bc_err_test_failed",
  Forbidden: "bc_admin_only",
};

const EMPTY_RULE: Record<AudienceKind, AudienceRule> = {
  buyers: { kind: "buyers", product_codes: [] },
  enrolled: { kind: "enrolled", course_ids: [] },
  leads: { kind: "leads", product_codes: [] },
  registered: { kind: "registered", opted_in_only: false },
  subscribers: { kind: "subscribers", sources: [] },
  tag: { kind: "tag", tags: [] },
};

type Draft = {
  title: string;
  subject: string;
  preheader: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: Audience;
};

function draftOf(b: BroadcastDetail): Draft {
  return {
    title: b.title,
    subject: b.subject,
    preheader: b.preheader,
    body: b.body,
    ctaLabel: b.ctaLabel ?? "",
    ctaUrl: b.ctaUrl ?? "",
    audience: b.audience,
  };
}

export function BroadcastEditor({
  initial,
  canEdit,
  onBack,
  onOpen,
}: {
  initial: BroadcastDetail;
  canEdit: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const { lang, t } = useI18n();
  const toast = useToast();
  const locale = getAdminLocale(lang);
  const [broadcast, setBroadcast] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [saved, setSaved] = useState<Draft>(() => draftOf(initial));
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [count, setCount] = useState<{ count: number; sample: { address: string }[] } | null>(null);
  const [counting, setCounting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmNote, setConfirmNote] = useState<string | null>(null);
  const [stats, setStats] = useState<BroadcastStats | null>(initial.stats);
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState<string | null>(null);
  const alive = useRef(true);

  const isDraft = broadcast.status === "draft";
  const editable = isDraft && canEdit;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isDraft) return;
    call<AudienceOptions>("/api/admin/broadcasts/audience").then(({ ok, data }) => {
      if (ok && alive.current) setOptions(data);
    });
  }, [isDraft]);

  /* The count follows the rule, debounced: the number on screen is always the
     one the current checkboxes mean, never the previous rule's. */
  const audienceKey = JSON.stringify(draft.audience);
  useEffect(() => {
    if (!isDraft) return;
    if (draft.audience.include.length === 0) {
      setCount({ count: 0, sample: [] });
      return;
    }
    setCounting(true);
    const timer = setTimeout(async () => {
      const { ok, data } = await call<{ count: number; sample: { address: string }[] }>(
        "/api/admin/broadcasts/audience",
        { method: "POST", body: JSON.stringify({ audience: draft.audience }) },
      );
      if (!alive.current) return;
      setCounting(false);
      if (ok) setCount(data);
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized rule
  }, [audienceKey, isDraft]);

  const preview = useMemo(
    () =>
      renderBroadcast(
        {
          subject: draft.subject,
          preheader: draft.preheader,
          body: draft.body,
          ctaLabel: draft.ctaLabel || null,
          ctaUrl: draft.ctaUrl || null,
        },
        { name: t("bc_preview_name") },
        "#",
      ),
    [draft.subject, draft.preheader, draft.body, draft.ctaLabel, draft.ctaUrl, t],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setAudience = (fn: (a: Audience) => Audience) => setDraft((d) => ({ ...d, audience: fn(d.audience) }));

  const errorText = (code: string) => {
    const key = ERROR_KEY[code];
    return key ? t(key) : code;
  };

  const save = useCallback(async (): Promise<boolean> => {
    const { ok, status, data } = await call<{ broadcast: BroadcastDetail }>(`/api/admin/broadcasts/${broadcast.id}`, {
      method: "PATCH",
      body: JSON.stringify(draft),
    });
    if (!ok) {
      toast.error(errorText(errorOf(data, status)));
      return false;
    }
    setBroadcast(data.broadcast);
    setSaved(draft);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast.id, draft, toast]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const onSave = () =>
    run(async () => {
      if (await save()) toast.success(t("bc_saved"));
    });

  const onTest = () =>
    run(async () => {
      if (dirty && !(await save())) return;
      const { ok, status, data } = await call<{ to?: string }>(`/api/admin/broadcasts/${broadcast.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "test" }),
      });
      if (!ok) return void toast.error(errorText(errorOf(data, status)));
      toast.success(`${t("bc_test_sent")} ${data.to ?? ""}`.trim());
    });

  const onDelete = () =>
    run(async () => {
      const { ok, status, data } = await call(`/api/admin/broadcasts/${broadcast.id}`, { method: "DELETE" });
      if (!ok) return void toast.error(errorText(errorOf(data, status)));
      toast.success(t("bc_deleted"));
      onBack();
    });

  const onDuplicate = () =>
    run(async () => {
      const { ok, status, data } = await call<{ broadcast: BroadcastDetail }>(`/api/admin/broadcasts/${broadcast.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "duplicate" }),
      });
      if (!ok) return void toast.error(errorText(errorOf(data, status)));
      toast.success(t("bc_duplicated"));
      onOpen(data.broadcast.id);
    });

  /* The page drives the sending: one batch per request, the next asked for as
     soon as the last answers, until nothing is pending or the provider says
     wait. Leaving the page stops asking; the server keeps the place. */
  const drive = useCallback(
    async (first: SendProgress) => {
      let progress = first;
      setSending(true);
      setPaused(null);
      try {
        while (alive.current) {
          setStats(progress.stats);
          setBroadcast((b) => ({ ...b, status: progress.status }));
          if (progress.status !== "sending") break;
          if (progress.paused === "rate_limited") {
            setPaused(progress.detail ?? "rate_limited");
            break;
          }
          if (progress.paused === "busy") await new Promise((r) => setTimeout(r, 3000));
          const { ok, status, data } = await call<SendProgress>(`/api/admin/broadcasts/${broadcast.id}`, {
            method: "POST",
            body: JSON.stringify({ action: "continue" }),
          });
          if (!ok) {
            toast.error(errorText(errorOf(data, status)));
            break;
          }
          progress = data;
        }
      } finally {
        if (alive.current) setSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [broadcast.id, toast],
  );

  const openConfirm = () =>
    run(async () => {
      if (dirty && !(await save())) return;
      setConfirmText("");
      setConfirmNote(null);
      setConfirmOpen(true);
    });

  const onConfirmSend = () =>
    run(async () => {
      const { ok, status, data } = await call<SendProgress & { error?: string; count?: number }>(
        `/api/admin/broadcasts/${broadcast.id}`,
        { method: "POST", body: JSON.stringify({ action: "start", confirmCount: Number(confirmText) }) },
      );
      if (!ok) {
        if (data.error === "audience_changed" && typeof data.count === "number") {
          setCount((c) => ({ count: data.count as number, sample: c?.sample ?? [] }));
          setConfirmText("");
          setConfirmNote(t("bc_audience_changed"));
          return;
        }
        toast.error(errorText(errorOf(data, status)));
        return;
      }
      setConfirmOpen(false);
      void drive(data);
    });

  const action = (name: "continue" | "cancel" | "retry") =>
    run(async () => {
      const { ok, status, data } = await call<SendProgress>(`/api/admin/broadcasts/${broadcast.id}`, {
        method: "POST",
        body: JSON.stringify({ action: name }),
      });
      if (!ok) return void toast.error(errorText(errorOf(data, status)));
      if (name === "cancel") toast.success(t("bc_stopped"));
      void drive(data);
    });

  const statusLabel = t(`bc_status_${broadcast.status}` as TranslationKey);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : "—");

  return (
    <div className={pageStyles.page}>
      <div className={bc.toolbar}>
        <button type="button" onClick={onBack} className={`${controls.action} cw-btn-muted`}>
          {t("bc_back")}
        </button>
        <span className="cw-muted">
          {statusLabel}
          {dirty && editable ? ` · ${t("bc_unsaved")}` : ""}
        </span>
      </div>

      {isDraft ? (
        <div className={bc.editor}>
          <div className={bc.column}>
            <section className={surfaces.plate}>
              <div className={controls.formStack}>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("bc_field_title")}</span>
                  <input
                    className={controls.input}
                    value={draft.title}
                    disabled={!editable}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder={t("bc_field_title_hint")}
                  />
                </label>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("bc_field_subject")}</span>
                  <input
                    className={controls.input}
                    value={draft.subject}
                    disabled={!editable}
                    onChange={(e) => set("subject", e.target.value)}
                  />
                </label>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("bc_field_preheader")}</span>
                  <input
                    className={controls.input}
                    value={draft.preheader}
                    disabled={!editable}
                    onChange={(e) => set("preheader", e.target.value)}
                    placeholder={t("bc_field_preheader_hint")}
                  />
                </label>
                <label className={controls.field}>
                  <span className={controls.fieldCaption}>{t("bc_field_body")}</span>
                  <textarea
                    className={bc.bodyField}
                    value={draft.body}
                    disabled={!editable}
                    onChange={(e) => set("body", e.target.value)}
                  />
                  <span className={controls.hint}>{t("bc_field_body_hint")}</span>
                </label>
                <div className={controls.fieldsTwo}>
                  <label className={controls.field}>
                    <span className={controls.fieldCaption}>{t("bc_field_cta_label")}</span>
                    <input
                      className={controls.input}
                      value={draft.ctaLabel}
                      disabled={!editable}
                      onChange={(e) => set("ctaLabel", e.target.value)}
                    />
                  </label>
                  <label className={controls.field}>
                    <span className={controls.fieldCaption}>{t("bc_field_cta_url")}</span>
                    <input
                      className={controls.input}
                      type="url"
                      inputMode="url"
                      value={draft.ctaUrl}
                      disabled={!editable}
                      onChange={(e) => set("ctaUrl", e.target.value)}
                      placeholder="https://"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className={surfaces.plate}>
              <div className={controls.formStack}>
                <div>
                  <span className={controls.fieldLabel}>{t("bc_audience")}</span>
                  <p className={controls.hint}>{t("bc_audience_hint")}</p>
                </div>
                <AudienceBuilder
                  audience={draft.audience}
                  options={options}
                  disabled={!editable}
                  onChange={setAudience}
                />
                <div className={bc.count} aria-live="polite">
                  <span className={controls.fieldCaption}>{t("bc_aud_count")}</span>
                  {draft.audience.include.length === 0 ? (
                    <span className="cw-muted">{t("bc_aud_none")}</span>
                  ) : counting || !count ? (
                    <span className="cw-muted">{t("bc_aud_counting")}</span>
                  ) : (
                    <span className={bc.countValue}>
                      {count.count} {t("bc_aud_people")}
                    </span>
                  )}
                </div>
                {count && count.sample.length > 0 && !counting ? (
                  <p className={bc.sample}>
                    {t("bc_aud_sample")}: {count.sample.map((s) => s.address).join(", ")}
                  </p>
                ) : null}
              </div>
            </section>

            {editable ? (
              <div className={controls.actions}>
                <button
                  type="button"
                  disabled={busy || !dirty}
                  onClick={onSave}
                  className={`${controls.action} cw-surface-2`}
                >
                  {t("bc_save")}
                </button>
                <button type="button" disabled={busy} onClick={onTest} className={`${controls.action} cw-surface-2`}>
                  {t("bc_test")}
                </button>
                <button
                  type="button"
                  disabled={busy || !count || count.count === 0 || counting}
                  onClick={openConfirm}
                  className={`${controls.action} cw-surface-2`}
                >
                  {t("bc_send")}
                </button>
                <button type="button" disabled={busy} onClick={onDelete} className={`${controls.action} cw-btn-muted`}>
                  {t("bc_delete")}
                </button>
              </div>
            ) : (
              <p className={controls.hint}>{t("bc_admin_only")}</p>
            )}
          </div>

          <div className={bc.previewColumn}>
            <span className={controls.fieldLabel}>{t("bc_preview")}</span>
            <p className={bc.previewSubject}>{preview.subject || "—"}</p>
            <iframe title={t("bc_preview")} className={bc.previewFrame} sandbox="" srcDoc={preview.html} />
          </div>
        </div>
      ) : (
        <div className={bc.editor}>
          <div className={bc.column}>
            <section className={surfaces.plate}>
              <div className={controls.formStack}>
                <span className={controls.fieldLabel}>{t("bc_progress")}</span>
                {stats ? (
                  <>
                    <div className={bc.meter} aria-hidden="true">
                      <div
                        className={bc.meterFill}
                        style={{ width: `${stats.total ? Math.round((stats.sent / stats.total) * 100) : 0}%` }}
                      />
                    </div>
                    <div className={bc.stats}>
                      {(
                        [
                          ["total", "bc_stat_total"],
                          ["sent", "bc_stat_sent"],
                          ["pending", "bc_stat_pending"],
                          ["failed", "bc_stat_failed"],
                          ["delivered", "bc_stat_delivered"],
                          ["opened", "bc_stat_opened"],
                          ["clicked", "bc_stat_clicked"],
                          ["bounced", "bc_stat_bounced"],
                          ["complained", "bc_stat_complained"],
                          ["unsubscribed", "bc_stat_unsubscribed"],
                          ["skipped", "bc_stat_skipped"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className={bc.stat}>
                          <span className={bc.statValue}>{stats[key] ?? 0}</span>
                          <span className={bc.statLabel}>{t(label)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className={controls.facts}>
                  <div className={controls.factRow}>
                    <span className={controls.factLabel}>{t("bc_started_at")}</span>
                    <span className={controls.factValue}>{when(broadcast.startedAt)}</span>
                  </div>
                  <div className={controls.factRow}>
                    <span className={controls.factLabel}>{t("bc_finished_at")}</span>
                    <span className={controls.factValue}>{when(broadcast.finishedAt)}</span>
                  </div>
                </div>
                {sending ? <p className={controls.hint}>{t("bc_keep_open")}</p> : null}
                {paused ? (
                  <p className={controls.hint}>
                    {t("bc_paused_rate")} ({paused})
                  </p>
                ) : null}
                {broadcast.errorText ? <p className="cw-status-failed-text">{broadcast.errorText}</p> : null}
              </div>
            </section>
            {canEdit ? (
              <div className={controls.actions}>
                {broadcast.status === "sending" && !sending ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => action("continue")}
                    className={`${controls.action} cw-surface-2`}
                  >
                    {t("bc_continue")}
                  </button>
                ) : null}
                {broadcast.status === "sending" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => action("cancel")}
                    className={`${controls.action} cw-btn-muted`}
                  >
                    {t("bc_stop")}
                  </button>
                ) : null}
                {stats && stats.failed > 0 && !sending ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => action("retry")}
                    className={`${controls.action} cw-surface-2`}
                  >
                    {t("bc_retry")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDuplicate}
                  className={`${controls.action} cw-surface-2`}
                >
                  {t("bc_duplicate")}
                </button>
              </div>
            ) : null}
          </div>
          <div className={bc.previewColumn}>
            <span className={controls.fieldLabel}>{t("bc_preview")}</span>
            <p className={bc.previewSubject}>{preview.subject || "—"}</p>
            <iframe title={t("bc_preview")} className={bc.previewFrame} sandbox="" srcDoc={preview.html} />
          </div>
        </div>
      )}

      {confirmOpen ? (
        <AdminModal
          title={t("bc_confirm_title")}
          onClose={() => setConfirmOpen(false)}
          footer={
            <div className={controls.actions}>
              <button type="button" onClick={() => setConfirmOpen(false)} className={`${controls.action} cw-btn-muted`}>
                {t("bc_cancel_dialog")}
              </button>
              <button
                type="button"
                disabled={busy || !count || confirmText.trim() !== String(count.count)}
                onClick={onConfirmSend}
                className={`${controls.action} cw-surface-2`}
              >
                {t("bc_confirm_go")}
              </button>
            </div>
          }
        >
          <div className={controls.confirmGroup}>
            <div className={controls.facts}>
              <div className={controls.factRow}>
                <span className={controls.factLabel}>{t("bc_field_subject")}</span>
                <span className={controls.factValue}>{preview.subject}</span>
              </div>
              <div className={controls.factRow}>
                <span className={controls.factLabel}>{t("bc_aud_count")}</span>
                <span className={controls.factValue}>{count?.count ?? "—"}</span>
              </div>
            </div>
            {confirmNote ? <p className="cw-status-failed-text">{confirmNote}</p> : null}
            <label className={controls.confirmLabel}>
              {t("bc_confirm_text")}
              <input
                className={controls.confirmInput}
                inputMode="numeric"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}

function AudienceBuilder({
  audience,
  options,
  disabled,
  onChange,
}: {
  audience: Audience;
  options: AudienceOptions | null;
  disabled: boolean;
  onChange: (fn: (a: Audience) => Audience) => void;
}) {
  const { t } = useI18n();
  const buyers = ruleOf(audience, "buyers");
  const enrolled = ruleOf(audience, "enrolled");
  const registered = ruleOf(audience, "registered");
  const leads = ruleOf(audience, "leads");
  const subscribers = ruleOf(audience, "subscribers");
  const tag = ruleOf(audience, "tag");

  const toggleKind = (kind: AudienceKind, on: boolean) =>
    onChange((a) => withRule(a, kind, on ? EMPTY_RULE[kind] : null));

  const head = (kind: AudienceKind, on: boolean, label: string, disabledHead = false) => (
    <label className={bc.groupHead}>
      <input
        type="checkbox"
        className={bc.checkBox}
        checked={on}
        disabled={disabled || disabledHead}
        onChange={(e) => toggleKind(kind, e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <div className={bc.groups}>
      <div className={bc.group}>
        {head("buyers", Boolean(buyers), t("bc_aud_buyers"))}
        {buyers && options ? (
          <div className={bc.options}>
            {options.products.map((p) => (
              <label key={p.code} className={bc.option}>
                <input
                  type="checkbox"
                  className={bc.checkBox}
                  disabled={disabled}
                  checked={buyers.product_codes.includes(p.code)}
                  onChange={() =>
                    onChange((a) =>
                      withRule(a, "buyers", { kind: "buyers", product_codes: toggled(buyers.product_codes, p.code) }),
                    )
                  }
                />
                {p.code} · {p.buyers}
              </label>
            ))}
            {buyers.product_codes.length === 0 ? <span className={bc.option}>({t("bc_aud_buyers_any")})</span> : null}
          </div>
        ) : null}
      </div>

      <div className={bc.group}>
        {head("enrolled", Boolean(enrolled), t("bc_aud_enrolled"))}
        {enrolled && options ? (
          <div className={bc.options}>
            {options.courses.map((c) => (
              <label key={c.id} className={bc.option}>
                <input
                  type="checkbox"
                  className={bc.checkBox}
                  disabled={disabled}
                  checked={enrolled.course_ids.includes(c.id)}
                  onChange={() =>
                    onChange((a) =>
                      withRule(a, "enrolled", { kind: "enrolled", course_ids: toggled(enrolled.course_ids, c.id) }),
                    )
                  }
                />
                {c.title}
              </label>
            ))}
            {enrolled.course_ids.length === 0 ? <span className={bc.option}>({t("bc_aud_enrolled_any")})</span> : null}
          </div>
        ) : null}
      </div>

      <div className={bc.group}>
        {head("registered", Boolean(registered), t("bc_aud_registered"))}
        {registered ? (
          <div className={bc.options}>
            <label className={bc.option}>
              <input
                type="checkbox"
                className={bc.checkBox}
                disabled={disabled}
                checked={registered.opted_in_only}
                onChange={(e) =>
                  onChange((a) => withRule(a, "registered", { kind: "registered", opted_in_only: e.target.checked }))
                }
              />
              {t("bc_aud_registered_optin")}
            </label>
          </div>
        ) : null}
      </div>

      <div className={bc.group}>{head("leads", Boolean(leads), t("bc_aud_leads"))}</div>

      <div className={bc.group}>
        {head("subscribers", Boolean(subscribers), t("bc_aud_subscribers"))}
        {subscribers && options && options.sources.length > 1 ? (
          <div className={bc.options}>
            {options.sources.map((source) => (
              <label key={source} className={bc.option}>
                <input
                  type="checkbox"
                  className={bc.checkBox}
                  disabled={disabled}
                  checked={subscribers.sources.includes(source)}
                  onChange={() =>
                    onChange((a) =>
                      withRule(a, "subscribers", {
                        kind: "subscribers",
                        sources: toggled(subscribers.sources, source),
                      }),
                    )
                  }
                />
                {source}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {options && options.tags.length > 0 ? (
        <>
          <div className={bc.group}>
            {head("tag", Boolean(tag), t("bc_aud_tags"))}
            <div className={bc.options}>
              {options.tags.map((value) => (
                <label key={value} className={bc.option}>
                  <input
                    type="checkbox"
                    className={bc.checkBox}
                    disabled={disabled}
                    checked={Boolean(tag?.tags.includes(value))}
                    onChange={() =>
                      onChange((a) => {
                        const tags = toggled(ruleOf(a, "tag")?.tags ?? [], value);
                        return withRule(a, "tag", tags.length ? { kind: "tag", tags } : null);
                      })
                    }
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>
          <div className={bc.group}>
            <span className={bc.groupHead}>{t("bc_aud_exclude_tags")}</span>
            <div className={bc.options}>
              {options.tags.map((value) => (
                <label key={value} className={bc.option}>
                  <input
                    type="checkbox"
                    className={bc.checkBox}
                    disabled={disabled}
                    checked={audience.exclude_tags.includes(value)}
                    onChange={() => onChange((a) => ({ ...a, exclude_tags: toggled(a.exclude_tags, value) }))}
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>
        </>
      ) : null}
      {options && options.products.length > 0 ? (
        <div className={bc.group}>
          <span className={bc.groupHead}>{t("bc_aud_exclude_buyers")}</span>
          <div className={bc.options}>
            {options.products.map((p) => (
              <label key={p.code} className={bc.option}>
                <input
                  type="checkbox"
                  className={bc.checkBox}
                  disabled={disabled}
                  checked={(audience.exclude_buyers ?? []).includes(p.code)}
                  onChange={() => onChange((a) => ({ ...a, exclude_buyers: toggled(a.exclude_buyers ?? [], p.code) }))}
                />
                {p.code}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
