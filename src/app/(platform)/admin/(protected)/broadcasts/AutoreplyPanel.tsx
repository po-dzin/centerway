"use client";

/**
 * «Автовідповіді»: a keyword in an Instagram comment → a reply under it and a
 * DM with the link. Replaces the Smart Sender flow.
 *
 * A rule is created off and turned on on purpose: its texts speak for the
 * brand. Reading is staff; writing is the owner's. The contract is
 * src/lib/autoreply and the webhook at /api/instagram/webhook.
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { authorizedJson } from "@/components/auth/authorizedFetch";
import { Icon } from "@/components/Icon";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { getErrorMessage } from "@/lib/errors";
import type { TranslationKey } from "@/lib/i18n";
import { MAX_VARIANTS } from "@/lib/autoreply/match";
import type { EventRow, RuleSummary } from "@/lib/autoreply/rules";
import controls from "@/components/admin/AdminControls.module.css";
import lists from "@/components/admin/AdminLists.module.css";

type Draft = {
  name: string;
  keywords: string;
  mediaId: string;
  publicReplies: string[];
  dmTexts: string[];
  buttonLabel: string;
  buttonUrl: string;
  openButtonLabel: string;
  followUpText: string;
  maxPerHour: string;
};

const EVENT_BADGE: Record<string, string> = {
  sent: "cw-status-success-badge",
  pending: "cw-status-pending-badge",
  failed: "cw-status-failed-badge",
};

function toDraft(rule: RuleSummary): Draft {
  return {
    name: rule.name,
    keywords: rule.keywords.join(", "),
    mediaId: rule.media_id ?? "",
    publicReplies: rule.public_replies,
    dmTexts: rule.dm_texts,
    buttonLabel: rule.button_label ?? "",
    buttonUrl: rule.button_url ?? "",
    openButtonLabel: rule.open_button_label ?? "",
    followUpText: rule.follow_up_text ?? "",
    maxPerHour: String(rule.max_per_hour),
  };
}

function toPayload(draft: Draft) {
  return {
    name: draft.name,
    keywords: draft.keywords.split(/[,\n]/),
    mediaId: draft.mediaId,
    publicReplies: draft.publicReplies,
    dmTexts: draft.dmTexts,
    buttonLabel: draft.buttonLabel,
    buttonUrl: draft.buttonUrl,
    openButtonLabel: draft.openButtonLabel,
    followUpText: draft.followUpText,
    maxPerHour: draft.maxPerHour,
  };
}

function errorText(message: string, t: (key: TranslationKey) => string): string {
  const key = `ar_err_${message}` as TranslationKey;
  const text = t(key);
  return text === key ? message : text;
}

export function AutoreplyPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const [rules, setRules] = useState<RuleSummary[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await authorizedJson<{ rules: RuleSummary[]; canEdit: boolean; connected: boolean }>(
        "/api/admin/autoreply",
      );
      setRules(data.rules);
      setCanEdit(data.canEdit);
      setConnected(data.connected);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const data = await authorizedJson<{ rule: { id: string } }>("/api/admin/autoreply", {
        method: "POST",
        body: JSON.stringify({ name: "", keywords: [], publicReplies: [], dmTexts: [] }),
      });
      await load();
      setOpenId(data.rule.id);
    } catch (e) {
      toast.error(errorText(getErrorMessage(e), t));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (rule: RuleSummary) => {
    setBusy(true);
    try {
      await authorizedJson(`/api/admin/autoreply/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      await load();
    } catch (e) {
      toast.error(errorText(getErrorMessage(e), t));
    } finally {
      setBusy(false);
    }
  };

  const open = rules?.find((rule) => rule.id === openId);
  if (open) {
    return (
      <RuleEditor
        key={open.id}
        rule={open}
        canEdit={canEdit}
        onBack={() => {
          setOpenId(null);
          void load();
        }}
        onToggle={() => void toggle(open)}
      />
    );
  }

  if (error) {
    return (
      <AdminErrorState
        title={t("common_error")}
        message={error}
        action={
          <button type="button" onClick={() => void load()} className={`${controls.action} cw-surface-2`}>
            {t("analytics_retry")}
          </button>
        }
      />
    );
  }
  if (!rules) return <AdminLoadingState variant="spinner" text={t("bc_loading")} />;

  return (
    <>
      <p className={controls.hint}>{t("ar_hint")}</p>
      {connected ? null : <p className={controls.hint}>{t("ar_not_connected")}</p>}
      {canEdit ? (
        <div className={controls.actions}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className={`${controls.action} cw-surface-2`}
          >
            <Icon name="plus" size={16} />
            {t("ar_new")}
          </button>
        </div>
      ) : (
        <p className={controls.hint}>{t("bc_admin_only")}</p>
      )}
      {rules.length === 0 ? (
        <AdminEmptyState
          icon={<Icon className="cw-muted" name="mail" size={20} />}
          title={t("ar_empty")}
          description={t("ar_empty_hint")}
        />
      ) : (
        <div className={lists.list}>
          {rules.map((rule) => (
            <button key={rule.id} type="button" onClick={() => setOpenId(rule.id)} className={lists.itemPress}>
              <div className={lists.itemBody}>
                <div className={lists.itemTitleRow}>
                  <p className={lists.itemTitle}>{rule.name || t("ar_untitled")}</p>
                  <span className={rule.enabled ? "cw-status-success-badge" : "cw-status-pending-badge"}>
                    {rule.enabled ? t("ar_on") : t("ar_off")}
                  </span>
                </div>
                <div className={lists.itemMeta}>
                  <span>{rule.keywords.join(", ")}</span>
                  <span>
                    {t("ar_stats")
                      .replace("{c}", String(rule.stats.comments))
                      .replace("{s}", String(rule.stats.sent))
                      .replace("{f}", String(rule.stats.failed))}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Variants({
  label,
  values,
  disabled,
  onChange,
}: {
  label: string;
  values: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={controls.field}>
      <span className={controls.fieldLabel}>{label}</span>
      {values.map((value, index) => (
        <div key={index} className={controls.field}>
          <span className={controls.fieldCaption}>
            {t("ar_variant")} {index + 1}
          </span>
          <div className={controls.inlineActionsTop}>
            <textarea
              className={controls.textareaShort}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(values.map((v, i) => (i === index ? e.target.value : v)))}
            />
            {disabled ? null : (
              <button
                type="button"
                aria-label={t("ar_variant_remove")}
                title={t("ar_variant_remove")}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className={controls.dialogClose}
              >
                <Icon name="trash" size={20} />
              </button>
            )}
          </div>
        </div>
      ))}
      {!disabled && values.length < MAX_VARIANTS ? (
        <button type="button" onClick={() => onChange([...values, ""])} className={`${controls.action} cw-surface-2`}>
          <Icon name="plus" size={16} />
          {t("ar_variant_add")}
        </button>
      ) : null}
    </div>
  );
}

function RuleEditor({
  rule,
  canEdit,
  onBack,
  onToggle,
}: {
  rule: RuleSummary;
  canEdit: boolean;
  onBack: () => void;
  onToggle: () => void;
}) {
  const { lang, t } = useI18n();
  const toast = useToast();
  const locale = getAdminLocale(lang);
  const [draft, setDraft] = useState<Draft>(() => toDraft(rule));
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    let live = true;
    authorizedJson<{ events: EventRow[] }>(`/api/admin/autoreply/${rule.id}`)
      .then((data) => live && setEvents(data.events))
      .catch(() => live && setEvents([]));
    return () => {
      live = false;
    };
  }, [rule.id]);

  const save = async () => {
    setBusy(true);
    try {
      await authorizedJson(`/api/admin/autoreply/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify(toPayload(draft)),
      });
      toast.success(t("ar_saved"));
    } catch (e) {
      toast.error(errorText(getErrorMessage(e), t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await authorizedJson(`/api/admin/autoreply/${rule.id}`, { method: "DELETE" });
      toast.success(t("ar_deleted"));
      onBack();
    } catch (e) {
      toast.error(errorText(getErrorMessage(e), t));
      setBusy(false);
    }
  };

  return (
    <>
      <div className={controls.actions}>
        <button type="button" onClick={onBack} className={`${controls.action} cw-btn-muted`}>
          <Icon name="arrow-left" size={16} />
          {t("ar_back")}
        </button>
      </div>
      <div className={controls.formStack}>
        <label className={controls.field}>
          <span className={controls.fieldCaption}>{t("ar_f_name")}</span>
          <input
            className={controls.input}
            value={draft.name}
            disabled={!canEdit}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <label className={controls.field}>
          <span className={controls.fieldCaption}>{t("ar_f_keywords")}</span>
          <input
            className={controls.input}
            value={draft.keywords}
            disabled={!canEdit}
            onChange={(e) => set({ keywords: e.target.value })}
          />
          <span className={controls.hint}>{t("ar_f_keywords_hint")}</span>
        </label>
        <label className={controls.field}>
          <span className={controls.fieldCaption}>{t("ar_f_media")}</span>
          <input
            className={controls.input}
            value={draft.mediaId}
            disabled={!canEdit}
            onChange={(e) => set({ mediaId: e.target.value })}
          />
        </label>
        <p className={controls.hint}>{t("ar_f_variants_hint")}</p>
        <Variants
          label={t("ar_f_public")}
          values={draft.publicReplies}
          disabled={!canEdit}
          onChange={(v) => set({ publicReplies: v })}
        />
        <Variants
          label={t("ar_f_dm")}
          values={draft.dmTexts}
          disabled={!canEdit}
          onChange={(v) => set({ dmTexts: v })}
        />
        <p className={controls.hint}>{t("ar_f_two_step_hint")}</p>
        <label className={controls.field}>
          <span className={controls.fieldCaption}>{t("ar_f_open_label")}</span>
          <input
            className={controls.input}
            value={draft.openButtonLabel}
            maxLength={20}
            disabled={!canEdit}
            onChange={(e) => set({ openButtonLabel: e.target.value })}
          />
        </label>
        <label className={controls.field}>
          <span className={controls.fieldCaption}>{t("ar_f_follow_up")}</span>
          <textarea
            className={controls.textareaShort}
            value={draft.followUpText}
            disabled={!canEdit}
            onChange={(e) => set({ followUpText: e.target.value })}
          />
        </label>
        <div className={controls.fieldsTwo}>
          <label className={controls.field}>
            <span className={controls.fieldCaption}>{t("ar_f_button_label")}</span>
            <input
              className={controls.input}
              value={draft.buttonLabel}
              disabled={!canEdit}
              onChange={(e) => set({ buttonLabel: e.target.value })}
            />
          </label>
          <label className={controls.field}>
            <span className={controls.fieldCaption}>{t("ar_f_button_url")}</span>
            <input
              className={controls.input}
              value={draft.buttonUrl}
              disabled={!canEdit}
              onChange={(e) => set({ buttonUrl: e.target.value })}
            />
            <span className={controls.hint}>{t("ar_f_button_url_hint")}</span>
          </label>
        </div>
        <label className={controls.field}>
          <span className={controls.fieldCaption}>{t("ar_f_cap")}</span>
          <input
            className={controls.input}
            inputMode="numeric"
            value={draft.maxPerHour}
            disabled={!canEdit}
            onChange={(e) => set({ maxPerHour: e.target.value.replace(/\D/g, "") })}
          />
        </label>
      </div>
      {canEdit ? (
        <div className={controls.actionsSplit}>
          <button
            type="button"
            disabled={busy}
            aria-label={t("ar_delete")}
            title={t("ar_delete")}
            onClick={() => setConfirmDelete(true)}
            className={controls.dialogClose}
          >
            <Icon name="trash" size={20} />
          </button>
          <div className={controls.actions}>
            <button type="button" disabled={busy} onClick={onToggle} className={`${controls.action} cw-btn-muted`}>
              {rule.enabled ? t("ar_turn_off") : t("ar_turn_on")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className={`${controls.action} cw-surface-2`}
            >
              {t("ar_save")}
            </button>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <AdminModal
          title={t("ar_delete_title")}
          description={t("ar_delete_body")}
          closeLabel={t("common_close")}
          onClose={() => setConfirmDelete(false)}
          footer={
            <div className={controls.actions}>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={`${controls.action} cw-btn-muted`}
              >
                {t("bc_cancel_dialog")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className={`${controls.action} cw-surface-2`}
              >
                {t("ar_delete")}
              </button>
            </div>
          }
        >
          <p className={controls.hint}>{rule.name || t("ar_untitled")}</p>
        </AdminModal>
      ) : null}
      <span className={controls.fieldLabel}>{t("ar_journal")}</span>
      {events === null ? (
        <AdminLoadingState variant="spinner" text={t("bc_loading")} />
      ) : events.length === 0 ? (
        <p className={controls.hint}>{t("ar_journal_empty")}</p>
      ) : (
        <div className={lists.list}>
          {events.map((event) => (
            <div key={event.id} className={lists.item}>
              <div className={lists.itemBody}>
                <div className={lists.itemTitleRow}>
                  <p className={lists.itemTypeCode}>{event.ig_username ? `@${event.ig_username}` : "—"}</p>
                  <span className={EVENT_BADGE[event.status] ?? "cw-status-pending-badge"}>
                    {t(`ar_ev_${event.status}` as TranslationKey)}
                  </span>
                </div>
                <div className={lists.itemMeta}>
                  {event.error ? <span>{event.error}</span> : null}
                  <span className={lists.itemIdFaint}>{new Date(event.created_at).toLocaleString(locale)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
