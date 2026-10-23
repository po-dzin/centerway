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
import { buildLink } from "@/lib/autoreply/link";
import { MAX_VARIANTS } from "@/lib/autoreply/match";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";
import type { EventRow, RuleSummary } from "@/lib/autoreply/rules";
import controls from "@/components/admin/AdminControls.module.css";
import surfaces from "@/components/admin/AdminSurfaces.module.css";
import styles from "./AutoreplyPanel.module.css";
import lists from "@/components/admin/AdminLists.module.css";

type Draft = {
  name: string;
  keywords: string[];
  publicOn: boolean;
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
    keywords: rule.keywords,
    publicOn: rule.public_replies.length > 0 || rule.keywords.length === 0,
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
    keywords: draft.keywords,
    mediaId: draft.mediaId,
    publicReplies: draft.publicOn ? draft.publicReplies : [],
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

  const totals = rules.reduce(
    (sum, rule) => ({
      comments: sum.comments + rule.stats.comments,
      sent: sum.sent + rule.stats.sent,
      skipped: sum.skipped + rule.stats.skipped,
      failed: sum.failed + rule.stats.failed,
    }),
    { comments: 0, sent: 0, skipped: 0, failed: 0 },
  );
  const tiles: [string, number][] = [
    [t("ar_tile_comments"), totals.comments],
    [t("ar_tile_sent"), totals.sent],
    [t("ar_tile_skipped"), totals.skipped],
    [t("ar_tile_failed"), totals.failed],
  ];

  return (
    <div className={controls.formStack}>
      <p className={controls.hint}>{t("ar_hint")}</p>
      {connected ? null : <p className={controls.hint}>{t("ar_not_connected")}</p>}
      <div className={styles.tiles}>
        {tiles.map(([label, value]) => (
          <div key={label} className={styles.tile}>
            <span className={styles.tileValue}>{value}</span>
            <span className={styles.tileLabel}>{label}</span>
          </div>
        ))}
      </div>
      <p className={styles.note}>{t("ar_tiles_note")}</p>
      <div className={styles.listHead}>
        <h3 className={styles.listTitle}>{t("ar_rules")}</h3>
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className={`${controls.action} cw-btn-primary`}
          >
            <Icon name="plus" size={16} />
            {t("ar_new")}
          </button>
        ) : null}
      </div>
      {canEdit ? null : <p className={controls.hint}>{t("bc_admin_only")}</p>}
      {rules.length === 0 ? (
        <AdminEmptyState
          icon={<Icon className="cw-muted" name="mail" size={20} />}
          title={t("ar_empty")}
          description={t("ar_empty_hint")}
        />
      ) : (
        <div className={styles.rules}>
          {rules.map((rule) => (
            <div key={rule.id} className={styles.rule}>
              <div className={styles.ruleMain}>
                <p className={styles.ruleName}>{rule.name || t("ar_untitled")}</p>
                <p className={styles.note}>{rule.keywords.join(", ")}</p>
              </div>
              <div className={styles.tags}>
                <span className={styles.tag}>Instagram</span>
                <span className={styles.tag}>{rule.media_id ? t("ar_tag_one_post") : t("ar_tag_all_posts")}</span>
              </div>
              <div className={styles.ruleState}>
                <span className={rule.enabled ? "cw-status-success-badge" : "cw-status-pending-badge"}>
                  {rule.enabled ? t("ar_on") : t("ar_off")}
                </span>
                <span className={styles.note}>
                  {t("ar_rule_stats")
                    .replace("{s}", String(rule.stats.sent))
                    .replace("{c}", String(rule.stats.comments))}
                </span>
              </div>
              <button type="button" onClick={() => setOpenId(rule.id)} className={`${controls.action} cw-btn-muted`}>
                {t("ar_open")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div className={styles.group}>
      {values.map((value, index) => (
        <div key={index} className={styles.variant}>
          <span className={styles.variantNumber}>{index + 1}</span>
          <textarea
            className={`${controls.textareaShort} ${styles.variantField}`}
            aria-label={`${label} ${index + 1}`}
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
      ))}
      {!disabled && values.length < MAX_VARIANTS ? (
        <div className={controls.actions}>
          <button type="button" onClick={() => onChange([...values, ""])} className={`${controls.action} cw-surface-2`}>
            <Icon name="plus" size={16} />
            {t("ar_variant_add")} ({values.length} {t("ar_of")} {MAX_VARIANTS})
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Req() {
  return (
    <span className={styles.required} aria-hidden="true">
      *
    </span>
  );
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <span className={styles.toggleText}>{label}</span>
      <input
        type="checkbox"
        role="switch"
        className={styles.switch}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Keywords({
  values,
  disabled,
  onChange,
}: {
  values: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const commit = () => {
    const words = input
      .split(/[,\n]/)
      .map((word) => word.trim())
      .filter((word) => word !== "" && !values.includes(word));
    if (words.length > 0) onChange([...values, ...words]);
    setInput("");
  };
  return (
    <div className={styles.group}>
      <div className={styles.chips}>
        {values.map((word) => (
          <span key={word} className={styles.chip}>
            {word}
            {disabled ? null : (
              <button
                type="button"
                aria-label={t("ar_variant_remove")}
                onClick={() => onChange(values.filter((w) => w !== word))}
                className={styles.chipRemove}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </span>
        ))}
        {disabled ? null : (
          <input
            className={`${controls.input} ${styles.chipInput}`}
            value={input}
            placeholder={t("ar_f_keywords_add")}
            onChange={(e) => setInput(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit();
              }
            }}
          />
        )}
      </div>
      <p className={styles.note}>{t("ar_f_keywords_hint")}</p>
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
    const missing: string[] = [];
    if (!draft.name.trim()) missing.push(t("ar_f_name"));
    if (draft.keywords.length === 0) missing.push(t("ar_f_keywords"));
    if (!draft.dmTexts.some((text) => text.trim() !== "")) missing.push(t("ar_f_dm"));
    if (draft.openButtonLabel.trim() && !draft.followUpText.trim()) missing.push(t("ar_f_follow_up"));
    if (draft.followUpText.trim() && !draft.openButtonLabel.trim()) missing.push(t("ar_f_open_label"));
    if (draft.followUpText.trim() && !draft.buttonUrl.trim()) missing.push(t("ar_s_button"));
    if (missing.length > 0) {
      toast.error(`${t("ar_missing")}: ${missing.join(", ")}`);
      return;
    }
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

  const finalLink = (() => {
    if (!draft.buttonUrl.trim()) return null;
    try {
      return buildLink(draft.buttonUrl.trim(), { name: draft.name, utmCampaign: rule.utm_campaign }, PLATFORM_ORIGIN);
    } catch {
      return null;
    }
  })();
  const twoStep = draft.followUpText.trim() !== "";
  const firstDm = draft.dmTexts.find((text) => text.trim() !== "") ?? "";
  const publicNote = draft.publicOn ? draft.publicReplies.find((text) => text.trim() !== "") : undefined;
  const stats = rule.stats;
  const barMax = Math.max(1, stats.comments);
  const bars: [string, number][] = [
    [t("ar_funnel_comments"), stats.comments],
    [t("ar_funnel_sent"), stats.sent],
    [t("ar_funnel_skipped"), stats.skipped],
    [t("ar_funnel_failed"), stats.failed],
  ];

  return (
    <div className={controls.formStack}>
      <div className={styles.head}>
        <button type="button" onClick={onBack} className={`${controls.action} cw-btn-muted`}>
          <Icon name="arrow-left" size={16} />
          {t("ar_back")}
        </button>
        <h3 className={styles.headTitle}>{draft.name || t("ar_untitled")}</h3>
        <div className={styles.headActions}>
          <span className={rule.enabled ? "cw-status-success-badge" : "cw-status-pending-badge"}>
            {rule.enabled ? t("ar_on") : t("ar_off")}
          </span>
          {canEdit ? (
            <>
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
              <button type="button" disabled={busy} onClick={onToggle} className={`${controls.action} cw-btn-muted`}>
                {rule.enabled ? t("ar_turn_off") : t("ar_turn_on")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className={`${controls.action} cw-btn-primary`}
              >
                {t("ar_save")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className={styles.editor}>
        <div className={styles.column}>
          <section className={`${surfaces.plate} ${styles.section}`}>
            <h4 className={styles.sectionTitle}>{t("ar_s_when")}</h4>
            <label className={styles.group}>
              <span className={styles.label}>
                {t("ar_f_name")} <Req />
              </span>
              <input
                className={controls.input}
                value={draft.name}
                disabled={!canEdit}
                onChange={(e) => set({ name: e.target.value })}
              />
            </label>
            <label className={styles.group}>
              <span className={styles.label}>{t("ar_f_media")}</span>
              <input
                className={controls.input}
                value={draft.mediaId}
                disabled={!canEdit}
                onChange={(e) => set({ mediaId: e.target.value })}
              />
            </label>
            <div className={styles.group}>
              <span className={styles.label}>
                {t("ar_f_keywords")} <Req />
              </span>
              <Keywords values={draft.keywords} disabled={!canEdit} onChange={(next) => set({ keywords: next })} />
            </div>
          </section>

          <section className={`${surfaces.plate} ${styles.section}`}>
            <h4 className={styles.sectionTitle}>{t("ar_s_public")}</h4>
            <Switch
              label={t("ar_public_on")}
              checked={draft.publicOn}
              disabled={!canEdit}
              onChange={(next) =>
                set({
                  publicOn: next,
                  publicReplies: next && draft.publicReplies.length === 0 ? [""] : draft.publicReplies,
                })
              }
            />
            {draft.publicOn ? (
              <Variants
                label={t("ar_variant")}
                values={draft.publicReplies}
                disabled={!canEdit}
                onChange={(v) => set({ publicReplies: v })}
              />
            ) : null}
            <p className={styles.note}>{t("ar_f_variants_hint")}</p>
          </section>

          <section className={`${surfaces.plate} ${styles.section}`}>
            <h4 className={styles.sectionTitle}>{t("ar_s_dm")}</h4>
            <p className={styles.note}>{t("ar_required_hint")}</p>
            <div className={styles.group}>
              <span className={styles.label}>
                {t("ar_f_dm")} <Req />
              </span>
              <Variants
                label={t("ar_variant")}
                values={draft.dmTexts}
                disabled={!canEdit}
                onChange={(v) => set({ dmTexts: v })}
              />
            </div>
            <div className={styles.group}>
              <span className={styles.label}>
                {t("ar_f_open_label")} {twoStep || draft.openButtonLabel.trim() ? <Req /> : null}
              </span>
              <input
                className={controls.input}
                value={draft.openButtonLabel}
                maxLength={20}
                disabled={!canEdit}
                onChange={(e) => set({ openButtonLabel: e.target.value })}
              />
            </div>
            <div className={styles.group}>
              <span className={styles.label}>
                {t("ar_f_follow_up")} {draft.openButtonLabel.trim() ? <Req /> : null}
              </span>
              <textarea
                className={controls.textareaShort}
                value={draft.followUpText}
                disabled={!canEdit}
                onChange={(e) => set({ followUpText: e.target.value })}
              />
              <p className={styles.note}>{t("ar_f_two_step_hint")}</p>
            </div>
            <div className={styles.group}>
              <span className={styles.label}>
                {t("ar_s_button")} {twoStep ? <Req /> : null}
              </span>
              <div className={controls.fieldsTwo}>
                <input
                  className={controls.input}
                  aria-label={t("ar_f_button_label")}
                  placeholder={t("ar_f_button_label")}
                  value={draft.buttonLabel}
                  disabled={!canEdit}
                  onChange={(e) => set({ buttonLabel: e.target.value })}
                />
                <input
                  className={controls.input}
                  aria-label={t("ar_f_button_url")}
                  placeholder={t("ar_f_button_url")}
                  value={draft.buttonUrl}
                  disabled={!canEdit}
                  onChange={(e) => set({ buttonUrl: e.target.value })}
                />
              </div>
              <p className={styles.note}>{t("ar_f_button_url_hint")}</p>
              {finalLink ? (
                <p className={styles.note}>
                  {t("ar_final_link")}: <span className={styles.finalLink}>{finalLink}</span>
                </p>
              ) : null}
            </div>
          </section>

          <section className={`${surfaces.plate} ${styles.section}`}>
            <h4 className={styles.sectionTitle}>{t("ar_s_safety")}</h4>
            <label className={styles.group}>
              <span className={styles.label}>{t("ar_f_cap")}</span>
              <input
                className={controls.input}
                inputMode="numeric"
                value={draft.maxPerHour}
                disabled={!canEdit}
                onChange={(e) => set({ maxPerHour: e.target.value.replace(/\D/g, "") })}
              />
            </label>
            <p className={styles.note}>{t("ar_safety_note")}</p>
          </section>
        </div>

        <div className={styles.side}>
          <section className={`${surfaces.plate} ${styles.section}`}>
            <h4 className={styles.sectionTitle}>{t("ar_s_preview")}</h4>
            <div className={styles.phone}>
              <div className={styles.bubbleMe}>{draft.keywords[0] ?? "…"}</div>
              <div className={styles.bubble}>
                <span>{firstDm || "…"}</span>
                {twoStep || draft.buttonUrl ? (
                  <span className={styles.bubbleButton}>
                    {twoStep
                      ? draft.openButtonLabel || t("ar_open_default")
                      : draft.buttonLabel || t("ar_link_default")}
                  </span>
                ) : null}
              </div>
              {twoStep ? (
                <div className={styles.bubble}>
                  <span>{draft.followUpText}</span>
                  <span className={styles.bubbleButton}>{draft.buttonLabel || t("ar_link_default")}</span>
                </div>
              ) : null}
            </div>
            {publicNote ? (
              <p className={styles.note}>
                {t("ar_preview_public")} «{publicNote}»
              </p>
            ) : null}
          </section>

          <section className={`${surfaces.plate} ${styles.section}`}>
            <h4 className={styles.sectionTitle}>{t("ar_s_funnel")}</h4>
            <div className={styles.bars}>
              {bars.map(([label, value]) => (
                <div key={label} className={styles.bar}>
                  <span>{label}</span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{ display: "block", width: `${(value / barMax) * 100}%` }}
                    />
                  </span>
                  <span className={styles.barValue}>{value}</span>
                </div>
              ))}
            </div>
            <p className={styles.note}>{t("ar_funnel_note")}</p>
          </section>

          <section className={`${surfaces.plate} ${styles.section}`}>
            <h4 className={styles.sectionTitle}>{t("ar_journal")}</h4>
            {events === null ? (
              <AdminLoadingState variant="spinner" text={t("bc_loading")} />
            ) : events.length === 0 ? (
              <p className={styles.note}>{t("ar_journal_empty")}</p>
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
          </section>
        </div>
      </div>

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
          <p className={controls.hint}>{draft.name || t("ar_untitled")}</p>
        </AdminModal>
      ) : null}
    </div>
  );
}
