"use client";

/**
 * «Формати й набори» — the ways through this program, and the programs it
 * carries inside it (2026-09-25).
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
 */

import { useCallback, useEffect, useMemo, useState } from "react";

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
  proposedAmount: string;
  cohortStartsOn: string;
  includes: string[];
};

function draftOf(format: BuilderFormatDto | null): Draft {
  return {
    format: format?.format ?? "group",
    label: format && !format.labelIsDefault ? format.label : "",
    summary: format?.summary ?? "",
    features: format?.features.join("\n") ?? "",
    mode: format?.mode ?? "checkout",
    proposedAmount: format?.proposedAmount ? String(format.proposedAmount) : "",
    cohortStartsOn: format?.cohortStartsOn ?? "",
    includes: format?.includes.map((program) => program.slug) ?? [],
  };
}

function inputOf(draft: Draft, locked: boolean): BuilderFormatInput | { error: string } {
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
  if (locked) return shared;
  return {
    ...shared,
    format: draft.format,
    mode: draft.mode,
    cohortStartsOn: draft.format === "group" ? draft.cohortStartsOn || null : null,
    includes: draft.includes,
  };
}

function nextModuleSlug(modules: CourseModule[], base: string): string {
  const taken = new Set(modules.map((module) => module.slug));
  if (!taken.has(base)) return base;
  for (let index = 2; ; index += 1) if (!taken.has(`${base}-${index}`)) return `${base}-${index}`;
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
  const [adding, setAdding] = useState("");

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
  const linked = useMemo(() => course.modules.filter(isLinkedModule), [course.modules]);
  const published = useMemo(
    () => (data?.includable ?? []).filter((program) => program.status === "published"),
    [data?.includable],
  );
  const linkable = published.filter((program) => !linked.some((module) => module.linkedCourseSlug === program.slug));

  /* ── Programs inside: content ── */

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
    setAdding("");
  }

  function removeLinked(id: string) {
    onChange(
      ["modules"],
      course.modules.filter((module) => module.id !== id),
    );
  }

  /* ── Formats: commerce ── */

  function startEdit(format: BuilderFormatDto | null) {
    setDraft(draftOf(format));
    setEditing(format ? format.code : "new");
  }

  async function save(format: BuilderFormatDto | null, submit: boolean) {
    const locked = Boolean(format && format.reviewStatus === "approved" && !data?.isOwner);
    const input = inputOf(draft, locked);
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
            : "Не вдалося зберегти формат",
      );
      return;
    }
    toast.success(submit ? "Формат надіслано на погодження" : "Формат збережено");
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
    const locked = approved && !data?.isOwner;
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
            {approved ? "Нова ціна, яку пропонуєте, ₴" : "Ціна, яку пропонуєте, ₴"}
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
            Остаточну ціну затверджує власник платформи — вона може відрізнятися.
          </span>
        </label>

        {!locked && draft.format === "group" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Старт потоку</span>
            <input
              className={styles.input}
              type="date"
              value={draft.cohortStartsOn}
              onChange={(event) => setDraft((prev) => ({ ...prev, cohortStartsOn: event.target.value }))}
            />
          </label>
        ) : null}

        {locked ? (
          <p className={css.note}>
            Формат уже продається: склад і старт потоку змінює власник платформи — напишіть нам.
          </p>
        ) : published.length === 0 ? (
          <p className={css.note}>У вас немає інших опублікованих програм, які можна вкласти.</p>
        ) : (
          <ChoiceSet<string>
            label="Також відкриває"
            hint="Ці програми відкриються покупцю цього формату разом з основною."
            options={published.map((program) => ({ value: program.slug, label: program.title }))}
            values={draft.includes}
            onChange={(next) => setDraft((prev) => ({ ...prev, includes: next ?? [] }))}
          />
        )}

        <div className={css.actions}>
          <button className={css.submitAction} type="button" disabled={busy} onClick={() => void save(format, true)}>
            {approved ? "Зберегти й надіслати" : "Надіслати на погодження"}
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

  return (
    <div className={css.root}>
      <section className={css.block} aria-labelledby="linked-programs-title">
        <header className={css.blockHead}>
          <h3 className={css.blockTitle} id="linked-programs-title">
            Програми всередині
          </h3>
          <p className={css.blockLead}>
            Ваші окремі програми в «Додаткових матеріалах» цієї. Контент не копіюється — у кожної свій прогрес. Хто їх
            відкриває, вирішує формат нижче.
          </p>
        </header>

        {linked.length > 0 ? (
          <ul className={css.list}>
            {linked.map((module) => (
              <li key={module.id} className={css.linkedRow}>
                <span className={css.linkedTitle}>{module.title}</span>
                <button className={styles.dangerAction} type="button" onClick={() => removeLinked(module.id)}>
                  Прибрати
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={css.note}>Поки жодної — програма стоїть сама.</p>
        )}

        {linkable.length > 0 ? (
          <div className={css.addRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Додати програму</span>
              <select className={styles.input} value={adding} onChange={(event) => setAdding(event.target.value)}>
                <option value="">Оберіть…</option>
                {linkable.map((program) => (
                  <option key={program.slug} value={program.slug}>
                    {program.title}
                  </option>
                ))}
              </select>
            </label>
            <button className={css.secondaryAction} type="button" disabled={!adding} onClick={() => addLinked(adding)}>
              Додати
            </button>
          </div>
        ) : null}
      </section>

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

        {data && data.formats.length > 0 ? (
          <ul className={css.list}>
            {data.formats.map((format) => (
              <li key={format.code} className={css.item}>
                <div className={css.itemHead}>
                  <h4 className={css.itemName}>{format.label}</h4>
                  <p className={css.itemPrice}>
                    {format.mode === "lead" && format.amount === null ? "за запитом" : price(format.amount)}
                  </p>
                </div>
                <p className={css.itemMeta}>
                  {[
                    format.labelIsDefault ? null : KIND_LABELS[format.format],
                    format.reviewStatus === "approved" && !format.active
                      ? "Знято з продажу"
                      : REVIEW_LABELS[format.reviewStatus],
                    format.mode === "lead" ? "через заявку" : null,
                    format.cohortStartsOn ? `старт ${formatDate(format.cohortStartsOn)}` : null,
                    format.proposedAmount !== null ? `пропозиція ${price(format.proposedAmount)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {format.features.length > 0 ? (
                  <ul className={css.itemFeatures}>
                    {format.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={css.itemIncludes}>
                    Список «що входить» ще не заповнено — на сторінці буде лише назва програми.
                  </p>
                )}
                {format.includes.length > 0 ? (
                  <p className={css.itemIncludes}>
                    Також відкриває: <strong>{format.includes.map((program) => program.title).join(" · ")}</strong>
                  </p>
                ) : null}
                {editing === format.code ? (
                  editor(format)
                ) : (
                  <div className={css.actions}>
                    <button className={css.secondaryAction} type="button" onClick={() => startEdit(format)}>
                      Змінити
                    </button>
                    {format.reviewStatus !== "approved" ? (
                      <button
                        className={styles.dangerAction}
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(format)}
                      >
                        Прибрати
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {data ? (
          editing === "new" ? (
            <div className={css.item}>
              <h4 className={css.itemName}>Новий формат</h4>
              {editor(null)}
            </div>
          ) : (
            <div className={css.actions}>
              <button className={css.secondaryAction} type="button" onClick={() => startEdit(null)}>
                Додати формат
              </button>
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
