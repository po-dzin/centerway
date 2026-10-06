"use client";

/**
 * «Формати й набори» — the ways through this program, and the programs it
 * carries inside it (2026-09-25; reworked 2026-10-03).
 *
 * TWO HALVES, TWO KINDS OF WRITE.
 *   · «Програми всередині» is CONTENT: a linked module in the course structure
 *     (`CourseModule.linkedCourseSlug`). It is edited like any other change to
 *     the course — through `onChange`, the draft, autosave and publish.
 *   · «Формати» is COMMERCE: rows in `experience_offers`, written through their
 *     own route. The author composes a format and PROPOSES a price; the owner
 *     approves it in the admin catalogue and sets the live price, which may
 *     differ. Nothing here puts a price on sale by itself.
 *
 * Which formats open which programs (the bundle) lives on the format, not on
 * the linked module: the module says where the program sits in this course,
 * the format says who may open it.
 *
 * ONE PLACE TO PUT A PROGRAM IN (G, 2026-10-03). A program used to be added
 * twice: once as a module in «Програми всередині», then again, ticked, inside
 * every format that should open it — two lists of the same programs, and the
 * second one buried in a form. Now a program is added once, and its row says
 * which formats open it, as toggles. Each toggle writes that format's bundle
 * at once; the format's own form no longer carries the list. The data did not
 * move: the row is a view over `format.includes`.
 *
 * THE FORMATS ARE CARDS, IN THE STOREFRONT'S TONES. A rule-separated list made
 * three formats read as three paragraphs; the page shows them as cards, each
 * washed in its tone (`OfferFormats.module.css`), and the builder now does the
 * same, so the author edits the thing the buyer will compare.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminDateField } from "@/components/admin/AdminDateField";
import { useI18n } from "@/components/I18nProvider";
import { getAdminLocale } from "@/lib/admin/adminLocale";
import { HandGraphic, Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { isLinkedModule, type Course, type CourseModule } from "@/lms-core";
import {
  createCourseFormat,
  deleteCourseFormat,
  loadCourseFormats,
  updateCourseFormat,
  type BuilderFormatDto,
  type BuilderFormatInput,
  type BuilderFormatKind,
  type BuilderFormatsDto,
} from "./builderClient";
import { ChoiceRow, ChoiceSet } from "./BuilderFields";
import styles from "./Builder.module.css";
import css from "./BuilderFormats.module.css";

const KIND_LABELS: Record<BuilderFormatKind, string> = {
  self: "Самостійно",
  group: "Група потоку",
  individual: "Індивідуальний супровід",
};

const REVIEW_LABELS: Record<BuilderFormatDto["reviewStatus"], string> = {
  draft: "Чернетка",
  proposed: "На погодженні",
  approved: "У продажу",
  declined: "Відхилено",
};

const UAH = new Intl.NumberFormat("uk-UA");
const DATE = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : DATE.format(date);
}

function price(amount: number | null): string {
  return amount === null ? "—" : `${UAH.format(amount)} ₴`;
}

type Draft = {
  format: BuilderFormatKind;
  label: string;
  summary: string;
  /** One point per line, as the author types it. */
  features: string;
  mode: "checkout" | "lead";
  /** The price typed in the form: a proposal from an author, the live price from an admin. */
  proposedAmount: string;
  cohortStartsOn: string;
  /** The owner's early price and its last day's next date, as typed. */
  earlyAmount: string;
  earlyUntil: string;
};

/* `draftOf` / `inputOf` are exported for BuilderFormats.test.ts only. */
export function draftOf(format: BuilderFormatDto | null, canSetPrice = false): Draft {
  // The owner edits the price the page shows; an author edits what they propose.
  const amount = canSetPrice ? (format?.amount ?? format?.proposedAmount) : format?.proposedAmount;
  return {
    format: format?.format ?? "group",
    label: format && !format.labelIsDefault ? format.label : "",
    summary: format?.summary ?? "",
    features: format?.features.join("\n") ?? "",
    mode: format?.mode ?? "checkout",
    proposedAmount: amount ? String(amount) : "",
    cohortStartsOn: format?.cohortStartsOn ?? "",
    earlyAmount: format?.earlyAmount ? String(format.earlyAmount) : "",
    earlyUntil: format?.earlyUntil ?? "",
  };
}

/**
 * The form as a write. It never carries `includes`: what a format opens is set
 * from the program's row, and a form opened before a toggle must not put the
 * old bundle back when it is saved.
 */
export function inputOf(draft: Draft, locked: boolean, canSetPrice = false): BuilderFormatInput | { error: string } {
  const amount = draft.proposedAmount.trim();
  const proposedAmount = amount ? Number(amount) : null;
  if (proposedAmount !== null && (!Number.isInteger(proposedAmount) || proposedAmount <= 0)) {
    return { error: "Ціна — ціле число гривень, більше нуля" };
  }
  const features = draft.features
    .split("\n")
    .map((line) => line.replace(/^\s*[-•·*]\s*/, "").trim())
    .filter(Boolean);
  if (features.length > 12) return { error: "Не більше 12 пунктів у списку" };
  if (features.some((line) => line.length > 160)) return { error: "Пункт списку — до 160 символів" };
  const shared: BuilderFormatInput = { label: draft.label, summary: draft.summary, features, proposedAmount };
  // The early price is the owner's, like the price: both halves or neither.
  if (canSetPrice && draft.mode === "checkout") {
    const earlyText = draft.earlyAmount.trim();
    const until = draft.earlyUntil.trim();
    if (!earlyText && !until) shared.early = null;
    else {
      const early = Number(earlyText);
      if (!earlyText || !Number.isInteger(early) || early <= 0) {
        return { error: "Рання ціна — ціле число гривень, більше нуля" };
      }
      if (!until) return { error: "Вкажіть, до якої дати діє рання ціна" };
      if (proposedAmount === null || early >= proposedAmount) return { error: "Рання ціна має бути нижчою за ціну" };
      shared.early = { amount: early, until };
    }
  }
  if (locked) return shared;
  return {
    ...shared,
    format: draft.format,
    mode: draft.mode,
    cohortStartsOn: draft.format === "group" ? draft.cohortStartsOn || null : null,
  };
}

function nextModuleSlug(modules: CourseModule[], base: string): string {
  const taken = new Set(modules.map((module) => module.slug));
  if (!taken.has(base)) return base;
  for (let index = 2; ; index += 1) if (!taken.has(`${base}-${index}`)) return `${base}-${index}`;
}

/** The status a card wears, and the tone of its dot. */
function statusOf(format: BuilderFormatDto): { label: string; tone: "live" | "waiting" | "off" | "declined" } {
  if (format.reviewStatus === "approved") {
    return format.active ? { label: REVIEW_LABELS.approved, tone: "live" } : { label: "Знято з продажу", tone: "off" };
  }
  if (format.reviewStatus === "proposed") return { label: REVIEW_LABELS.proposed, tone: "waiting" };
  if (format.reviewStatus === "declined") return { label: REVIEW_LABELS.declined, tone: "declined" };
  return { label: REVIEW_LABELS.draft, tone: "off" };
}

export function BuilderFormats({
  course,
  onChange,
}: {
  course: Course;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const toast = useToast();
  const [read, setRead] = useState<{ slug: string | null; data: BuilderFormatsDto | null; failed: boolean }>({
    slug: null,
    data: null,
    failed: false,
  });
  /** The format being edited: a code, `"new"`, or nothing. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(null));
  const [busy, setBusy] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing === null) return;
    editorRef.current?.focus({ preventScroll: true });
    editorRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [editing]);

  const refresh = useCallback(async () => {
    const result = await loadCourseFormats(course.slug);
    setRead(
      result.ok
        ? { slug: course.slug, data: result.data, failed: false }
        : { slug: course.slug, data: null, failed: true },
    );
  }, [course.slug]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadCourseFormats(course.slug);
      if (cancelled) return;
      setRead(
        result.ok
          ? { slug: course.slug, data: result.data, failed: false }
          : { slug: course.slug, data: null, failed: true },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [course.slug]);

  const data = read.slug === course.slug ? read.data : null;
  const failed = read.slug === course.slug && read.failed;
  const canSetPrice = data?.canSetPrice === true;
  // The design system's one calendar (AdminDateField), never the browser's.
  const { lang, t } = useI18n();
  const dateLabels = useMemo(
    () => ({
      open: t("access_date_open"),
      clear: t("access_deadline_clear"),
      today: t("access_date_today"),
      placeholder: t("access_date_placeholder"),
    }),
    [t],
  );
  const linked = useMemo(() => course.modules.filter(isLinkedModule), [course.modules]);
  const published = useMemo(
    () => (data?.includable ?? []).filter((program) => program.status === "published"),
    [data?.includable],
  );
  const linkable = published.filter((program) => !linked.some((module) => module.linkedCourseSlug === program.slug));
  const lockedFor = (format: BuilderFormatDto) => format.reviewStatus === "approved" && !data?.isOwner;

  /* ── Programs inside: content, and which formats open each ── */

  function addLinked(slug: string) {
    const program = published.find((entry) => entry.slug === slug);
    if (!program) return;
    const order = Math.max(0, ...course.modules.map((module) => module.order)) + 1;
    const linkedModule: CourseModule = {
      id: crypto.randomUUID(),
      slug: nextModuleSlug(course.modules, program.slug),
      title: program.title,
      order,
      reference: true,
      linkedCourseSlug: program.slug,
      lessons: [],
    };
    onChange(["modules"], [...course.modules, linkedModule]);
  }

  /** Writes one format's bundle. Returns whether it landed. */
  async function writeIncludes(format: BuilderFormatDto, slugs: string[]): Promise<boolean> {
    const result = await updateCourseFormat(course.slug, format.code, { includes: slugs, submit: false });
    if (!result.ok) {
      toast.error(
        result.failure === "forbidden"
          ? "Вкласти можна лише власну програму"
          : result.detail === "format_approved_locked"
            ? "Склад погодженого формату змінює власник"
            : "Не вдалося змінити, що відкриває формат",
      );
    }
    return result.ok;
  }

  /** The owner's «Бестселер» mark — one per program; marking one clears the rest. */
  async function setFeatured(format: BuilderFormatDto, featured: boolean) {
    setBusy(true);
    const result = await updateCourseFormat(course.slug, format.code, { featured, submit: false });
    setBusy(false);
    if (!result.ok) {
      toast.error("Не вдалося змінити позначку «Бестселер»");
      return;
    }
    await refresh();
  }

  async function setOpeners(programSlug: string, codes: string[]) {
    if (!data) return;
    const changed = data.formats.filter(
      (format) =>
        !lockedFor(format) &&
        codes.includes(format.code) !== format.includes.some((program) => program.slug === programSlug),
    );
    if (changed.length === 0) return;
    setBusy(true);
    for (const format of changed) {
      const rest = format.includes.map((program) => program.slug).filter((slug) => slug !== programSlug);
      if (!(await writeIncludes(format, codes.includes(format.code) ? [...rest, programSlug] : rest))) break;
    }
    setBusy(false);
    await refresh();
  }

  async function removeLinked(module: CourseModule) {
    onChange(
      ["modules"],
      course.modules.filter((entry) => entry.id !== module.id),
    );
    // A program taken out of the course is taken out of the bundles that can
    // still be changed; a format on sale keeps what its buyers were promised.
    const slug = module.linkedCourseSlug!;
    const opening = (data?.formats ?? []).filter(
      (format) => !lockedFor(format) && format.includes.some((program) => program.slug === slug),
    );
    if (opening.length === 0) return;
    setBusy(true);
    for (const format of opening) {
      if (
        !(await writeIncludes(
          format,
          format.includes.map((program) => program.slug).filter((one) => one !== slug),
        ))
      )
        break;
    }
    setBusy(false);
    await refresh();
  }

  /* ── Formats: commerce ── */

  function startEdit(format: BuilderFormatDto | null) {
    setDraft(draftOf(format, canSetPrice));
    setEditing(format ? format.code : "new");
  }

  async function save(format: BuilderFormatDto | null, submit: boolean) {
    const locked = Boolean(format && lockedFor(format));
    const input = inputOf(draft, locked, canSetPrice);
    if ("error" in input) {
      toast.error(input.error);
      return;
    }
    setBusy(true);
    const result = format
      ? await updateCourseFormat(course.slug, format.code, { ...input, submit })
      : await createCourseFormat(course.slug, { ...input, submit });
    setBusy(false);
    if (!result.ok) {
      toast.error(
        result.failure === "forbidden"
          ? "Вкласти можна лише власну програму"
          : result.detail === "format_approved_locked"
            ? "Склад і старт погодженого формату змінює власник"
            : result.detail === "format_invalid_amount"
              ? "Для оплати на сторінці потрібна ціна"
              : result.detail === "format_early_not_lower"
                ? "Рання ціна має бути нижчою за ціну"
                : "Не вдалося зберегти формат",
      );
      return;
    }
    toast.success(
      canSetPrice
        ? submit || format?.reviewStatus === "approved"
          ? "Формат у продажу"
          : "Формат збережено"
        : submit
          ? "Формат надіслано на погодження"
          : "Формат збережено",
    );
    setEditing(null);
    await refresh();
  }

  async function remove(format: BuilderFormatDto) {
    setBusy(true);
    const result = await deleteCourseFormat(course.slug, format.code);
    setBusy(false);
    if (!result.ok) {
      toast.error("Не вдалося прибрати формат");
      return;
    }
    toast.success("Формат прибрано");
    await refresh();
  }

  function editor(format: BuilderFormatDto | null) {
    const approved = format?.reviewStatus === "approved";
    const locked = Boolean(format && lockedFor(format));
    const pending =
      canSetPrice && format?.proposedAmount != null && format.proposedAmount !== format.amount
        ? format.proposedAmount
        : null;
    return (
      <div className={css.editor}>
        {!locked ? (
          <ChoiceRow<BuilderFormatKind>
            label="Формат"
            options={(Object.keys(KIND_LABELS) as BuilderFormatKind[]).map((kind) => ({
              value: kind,
              label: KIND_LABELS[kind],
            }))}
            value={draft.format}
            onChange={(kind) =>
              kind && setDraft((prev) => ({ ...prev, format: kind, mode: kind === "individual" ? "lead" : prev.mode }))
            }
          />
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Назва на сторінці</span>
          <input
            className={styles.input}
            value={draft.label}
            maxLength={60}
            placeholder={KIND_LABELS[draft.format]}
            onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Що входить</span>
          <textarea
            className={styles.input}
            value={draft.features}
            rows={6}
            placeholder={
              "Кожен пункт з нового рядка, наприклад:\nУсе з формату «Самостійно»\nЗакрита Telegram-група потоку"
            }
            onChange={(event) => setDraft((prev) => ({ ...prev, features: event.target.value }))}
          />
          <span className={styles.fieldHint}>
            Кожен рядок — окремий пункт на картці формату. Програми з набору додаються окремо, як бонус.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Коротко про формат</span>
          <textarea
            className={styles.input}
            value={draft.summary}
            maxLength={240}
            rows={2}
            placeholder="Необов'язково: одне речення під ціною"
            onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
          />
        </label>

        {!locked ? (
          <ChoiceRow<"checkout" | "lead">
            label="Як купують"
            options={[
              { value: "checkout", label: "Оплата на сторінці" },
              { value: "lead", label: "Заявка, ціну узгоджуємо" },
            ]}
            value={draft.mode}
            onChange={(mode) => mode && setDraft((prev) => ({ ...prev, mode }))}
          />
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {canSetPrice ? "Ціна, ₴" : approved ? "Нова ціна, яку пропонуєте, ₴" : "Ціна, яку пропонуєте, ₴"}
          </span>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.proposedAmount}
            onChange={(event) => setDraft((prev) => ({ ...prev, proposedAmount: event.target.value }))}
          />
          <span className={styles.fieldHint}>
            {canSetPrice
              ? `Ціна на сторінці — змінюється одразу, без погодження.${
                  pending !== null ? ` Чекає пропозиція ${price(pending)}: збережіть її, щоб прийняти.` : ""
                }`
              : "Остаточну ціну затверджує власник платформи — вона може відрізнятися."}
          </span>
        </label>

        {canSetPrice && draft.mode === "checkout" ? (
          <div className={css.earlyFields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Рання ціна, ₴</span>
              <input
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={1}
                value={draft.earlyAmount}
                onChange={(event) => setDraft((prev) => ({ ...prev, earlyAmount: event.target.value }))}
              />
            </label>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`format-early-until-${format?.code ?? "new"}`}>
                Діє до
              </label>
              <AdminDateField
                id={`format-early-until-${format?.code ?? "new"}`}
                value={draft.earlyUntil}
                onChange={(next) => setDraft((prev) => ({ ...prev, earlyUntil: next }))}
                locale={getAdminLocale(lang)}
                labels={dateLabels}
              />
            </div>
            <span className={`${styles.fieldHint} ${css.earlyHint}`}>
              До 00:00 за Києвом цієї дати оплата йде за ранньою ціною, далі за звичайною. На сторінці: таймер і рядок
              «До … ранньої ціни, далі …». Порожні поля прибирають ранню ціну.
            </span>
          </div>
        ) : null}

        {!locked && draft.format === "group" ? (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`format-cohort-${format?.code ?? "new"}`}>
              Старт потоку
            </label>
            <AdminDateField
              id={`format-cohort-${format?.code ?? "new"}`}
              value={draft.cohortStartsOn}
              onChange={(next) => setDraft((prev) => ({ ...prev, cohortStartsOn: next }))}
              locale={getAdminLocale(lang)}
              labels={dateLabels}
            />
          </div>
        ) : null}

        {locked ? (
          <p className={css.note}>
            Формат уже продається: склад і старт потоку змінює власник платформи — напишіть нам.
          </p>
        ) : null}

        <div className={css.actions}>
          <button className={css.submitAction} type="button" disabled={busy} onClick={() => void save(format, true)}>
            {canSetPrice
              ? approved
                ? "Зберегти"
                : "Відкрити продаж"
              : approved
                ? "Зберегти й надіслати"
                : "Надіслати на погодження"}
          </button>
          {!approved ? (
            <button
              className={css.secondaryAction}
              type="button"
              disabled={busy}
              onClick={() => void save(format, false)}
            >
              Зберегти чернетку
            </button>
          ) : null}
          <button className={css.secondaryAction} type="button" disabled={busy} onClick={() => setEditing(null)}>
            Скасувати
          </button>
        </div>
      </div>
    );
  }

  function card(format: BuilderFormatDto) {
    const status = statusOf(format);
    const pendingPrice = format.proposedAmount !== null && format.proposedAmount !== format.amount;
    return (
      <li
        key={format.code}
        className={css.card}
        data-format={format.format}
        data-editing={editing === format.code}
        data-featured={format.featured ? "" : undefined}
      >
        {format.featured ? <p className={css.cardBestseller}>Бестселер</p> : null}
        <div className={css.cardHead}>
          {/* The kind, unless the name already is the kind's own word. */}
          <span className={css.cardKind}>{format.labelIsDefault ? null : KIND_LABELS[format.format]}</span>
          <span className={css.cardStatus} data-tone={status.tone}>
            <HandGraphic className={css.cardStatusDot} name="dot" size={14} />
            {status.label}
          </span>
        </div>

        <h4 className={css.cardTitle}>{format.label}</h4>

        <div className={css.cardPrice}>
          <p className={css.cardPriceValue}>
            {format.mode === "lead" && format.amount === null ? "за запитом" : price(format.amount)}
          </p>
          <p className={css.cardPriceNote}>
            {[
              format.mode === "lead" ? "через заявку" : null,
              format.cohortStartsOn ? `старт ${formatDate(format.cohortStartsOn)}` : null,
              pendingPrice ? `пропозиція ${price(format.proposedAmount)}` : null,
              format.earlyAmount && format.earlyUntil
                ? `рання ${price(format.earlyAmount)} до ${formatDate(format.earlyUntil)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {format.summary ? <p className={css.cardSummary}>{format.summary}</p> : null}

        {format.features.length > 0 ? (
          <ul className={css.cardFeatures}>
            {format.features.map((feature) => (
              <li key={feature}>
                <Icon className={css.cardTick} name="check" size={20} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={css.note}>Список «що входить» ще не заповнено — на сторінці буде лише назва програми.</p>
        )}

        {format.includes.length > 0 ? (
          <div className={css.cardBonus}>
            <p className={css.cardBonusLabel}>Також відкриває</p>
            <ul className={css.cardFeatures}>
              {format.includes.map((program) => (
                <li key={program.slug}>
                  <Icon className={css.cardPlus} name="plus" size={20} />
                  <span>{program.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={css.cardActions}>
          <button
            className={css.secondaryAction}
            type="button"
            aria-expanded={editing === format.code}
            aria-controls={`format-editor-${course.slug}`}
            onClick={() => (editing === format.code ? setEditing(null) : startEdit(format))}
          >
            Змінити
          </button>
          {canSetPrice && (data?.formats.length ?? 0) > 1 ? (
            <button
              className={css.secondaryAction}
              type="button"
              disabled={busy}
              aria-pressed={format.featured === true}
              onClick={() => void setFeatured(format, !format.featured)}
            >
              {format.featured ? "Зняти «Бестселер»" : "Зробити бестселером"}
            </button>
          ) : null}
          {format.reviewStatus !== "approved" ? (
            <button className={styles.dangerAction} type="button" disabled={busy} onClick={() => void remove(format)}>
              Прибрати
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  const editingFormat = data?.formats.find((format) => format.code === editing) ?? null;

  return (
    <div className={css.root}>
      <section className={css.block} aria-labelledby="course-formats-title">
        <header className={css.blockHead}>
          <h3 className={css.blockTitle} id="course-formats-title">
            Формати
          </h3>
          <p className={css.blockLead}>
            Способи пройти програму: самостійно, у групі, із супроводом. Коли їх два й більше, сторінка показує їх
            поруч.
          </p>
        </header>

        {failed ? <p className={css.note}>Не вдалося прочитати формати. Оновіть сторінку.</p> : null}
        {!data && !failed ? <p className={css.note}>Завантаження…</p> : null}

        {data ? (
          <ul className={css.cards}>
            {data.formats.map(card)}
            {editing !== "new" ? (
              <li className={css.cardAdd}>
                <button className={css.secondaryAction} type="button" onClick={() => startEdit(null)}>
                  <Icon name="plus" size={20} />
                  Додати формат
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}

        {data && editing !== null ? (
          <div
            ref={editorRef}
            id={`format-editor-${course.slug}`}
            role="region"
            aria-labelledby={`format-editor-title-${course.slug}`}
            tabIndex={-1}
            className={css.editorPanel}
            data-format={editing === "new" ? draft.format : editingFormat?.format}
          >
            <h4 className={css.editorTitle} id={`format-editor-title-${course.slug}`}>
              {editing === "new" ? "Новий формат" : editingFormat?.label}
            </h4>
            {editing === "new" ? editor(null) : editingFormat ? editor(editingFormat) : null}
          </div>
        ) : null}
      </section>

      <section className={css.block} aria-labelledby="linked-programs-title">
        <header className={css.blockHead}>
          <h3 className={css.blockTitle} id="linked-programs-title">
            Програми всередині
          </h3>
          <p className={css.blockLead}>
            Ваші окремі програми в «Додаткових матеріалах» цієї. Контент не копіюється — у кожної свій прогрес. Хто їх
            відкриває, вирішують формати: позначте їх біля програми.
          </p>
        </header>

        {linked.length > 0 ? (
          <ul className={css.list}>
            {linked.map((module) => {
              const slug = module.linkedCourseSlug!;
              const formats = data?.formats ?? [];
              const opening = formats
                .filter((format) => format.includes.some((program) => program.slug === slug))
                .map((format) => format.code);
              return (
                <li key={module.id} className={css.linkedRow}>
                  <div className={css.linkedHead}>
                    <span className={css.linkedTitle}>{module.title}</span>
                    <button
                      className={styles.dangerAction}
                      type="button"
                      disabled={busy}
                      onClick={() => void removeLinked(module)}
                    >
                      Прибрати
                    </button>
                  </div>
                  {formats.length > 0 ? (
                    <ChoiceSet<string>
                      label="Відкривають формати"
                      hint={
                        [
                          opening.length === 0
                            ? "Жоден формат її не відкриває: покупці бачать програму в матеріалах закритою."
                            : null,
                          formats.some(lockedFor)
                            ? "Що відкриває формат у продажу, змінює власник платформи — напишіть нам."
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                      options={formats.map((format) => ({
                        value: format.code,
                        label: format.label,
                        disabled: busy || lockedFor(format),
                      }))}
                      values={opening}
                      onChange={(next) => void setOpeners(slug, next ?? [])}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={css.note}>Поки жодної — програма стоїть сама.</p>
        )}

        {linkable.length > 0 ? (
          <label className={`${styles.field} ${css.addProgram}`}>
            <span className={styles.fieldLabel}>Додати програму</span>
            <select
              className={`${styles.input} ${styles.select}`}
              value=""
              onChange={(event) => addLinked(event.target.value)}
            >
              <option value="" disabled>
                Оберіть…
              </option>
              {linkable.map((program) => (
                <option key={program.slug} value={program.slug}>
                  {program.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>
    </div>
  );
}
