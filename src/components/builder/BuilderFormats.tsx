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
import styles from "./Builder.module.css";

const KIND_LABELS: Record<BuilderFormatKind, string> = {
  self: "Самостійно",
  group: "Група потоку",
  individual: "Індивідуальний супровід",
};

const REVIEW_LABELS: Record<BuilderFormatDto["reviewStatus"], string> = {
  draft: "Чернетка",
  proposed: "На погодженні",
  approved: "Погоджено",
  declined: "Відхилено",
};

const UAH = new Intl.NumberFormat("uk-UA");

function price(amount: number | null): string {
  return amount === null ? "—" : `${UAH.format(amount)} ₴`;
}

type Draft = {
  format: BuilderFormatKind;
  label: string;
  summary: string;
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
  const shared: BuilderFormatInput = { label: draft.label, summary: draft.summary, proposedAmount };
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
      <div className={styles.settingsForm}>
        {!locked ? (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Формат</span>
            <div className={styles.choiceRow} role="group" aria-label="Формат">
              {(Object.keys(KIND_LABELS) as BuilderFormatKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={styles.choiceOption}
                  aria-pressed={draft.format === kind}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, format: kind, mode: kind === "individual" ? "lead" : prev.mode }))
                  }
                >
                  {KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          </div>
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
          <span className={styles.fieldLabel}>Що дає цей формат</span>
          <textarea
            className={styles.input}
            value={draft.summary}
            maxLength={240}
            rows={2}
            onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
          />
        </label>

        {!locked ? (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Як купують</span>
            <div className={styles.choiceRow} role="group" aria-label="Як купують">
              <button
                type="button"
                className={styles.choiceOption}
                aria-pressed={draft.mode === "checkout"}
                onClick={() => setDraft((prev) => ({ ...prev, mode: "checkout" }))}
              >
                Оплата на сторінці
              </button>
              <button
                type="button"
                className={styles.choiceOption}
                aria-pressed={draft.mode === "lead"}
                onClick={() => setDraft((prev) => ({ ...prev, mode: "lead" }))}
              >
                Заявка, ціну узгоджуємо
              </button>
            </div>
          </div>
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
          <span className={styles.readOnlyNote}>
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

        {!locked ? (
          <fieldset className={styles.field}>
            <legend className={styles.fieldLabel}>Також відкриває</legend>
            {published.length === 0 ? (
              <p className={styles.readOnlyNote}>У вас немає інших опублікованих програм.</p>
            ) : (
              published.map((program) => (
                <label key={program.slug} className={styles.fieldLabel}>
                  <input
                    type="checkbox"
                    checked={draft.includes.includes(program.slug)}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        includes: event.target.checked
                          ? [...prev.includes, program.slug]
                          : prev.includes.filter((slug) => slug !== program.slug),
                      }))
                    }
                  />{" "}
                  {program.title}
                </label>
              ))
            )}
          </fieldset>
        ) : (
          <p className={styles.readOnlyNote}>
            Формат уже продається: склад і старт потоку змінює власник платформи — напишіть нам.
          </p>
        )}

        <div className={styles.authorLinkActions}>
          {!approved ? (
            <button
              className={styles.quietAction}
              type="button"
              disabled={busy}
              onClick={() => void save(format, true)}
            >
              Надіслати на погодження
            </button>
          ) : null}
          <button
            className={styles.quietAction}
            type="button"
            disabled={busy}
            onClick={() => void save(format, approved)}
          >
            {approved ? "Зберегти й надіслати" : "Зберегти чернетку"}
          </button>
          <button className={styles.quietAction} type="button" disabled={busy} onClick={() => setEditing(null)}>
            Скасувати
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsForm}>
      <section className={styles.courseSettingSection} aria-labelledby="linked-programs-title">
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle} id="linked-programs-title">
            Програми всередині
          </h3>
          <p className={styles.readOnlyNote}>
            Ваші окремі програми, які стоять у «Додаткових матеріалах» цієї. Контент не копіюється — у кожної свій
            прогрес. Хто їх відкриває, вирішує формат нижче.
          </p>
        </div>
        {linked.length > 0 ? (
          <ul className={styles.settingsForm}>
            {linked.map((module) => (
              <li key={module.id} className={styles.authorLinkActions}>
                <span>{module.title}</span>
                <button className={styles.dangerAction} type="button" onClick={() => removeLinked(module.id)}>
                  Прибрати
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {linkable.length > 0 ? (
          <div className={styles.authorLinkActions}>
            <label className={styles.readOnlyNote} htmlFor="linked-program-add">
              Додати програму
            </label>
            <select
              id="linked-program-add"
              className={styles.input}
              value={adding}
              onChange={(event) => setAdding(event.target.value)}
            >
              <option value="">Оберіть…</option>
              {linkable.map((program) => (
                <option key={program.slug} value={program.slug}>
                  {program.title}
                </option>
              ))}
            </select>
            <button className={styles.quietAction} type="button" disabled={!adding} onClick={() => addLinked(adding)}>
              Додати
            </button>
          </div>
        ) : null}
      </section>

      <section className={styles.courseSettingSection} aria-labelledby="course-formats-title">
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle} id="course-formats-title">
            Формати
          </h3>
          <p className={styles.readOnlyNote}>
            Способи пройти програму: самостійно, у групі, із супроводом. Два й більше — сторінка показує їх поруч.
          </p>
        </div>

        {failed ? <p className={styles.readOnlyNote}>Не вдалося прочитати формати. Оновіть сторінку.</p> : null}
        {!data && !failed ? <p className={styles.readOnlyNote}>Завантаження…</p> : null}

        {data?.formats.map((format) => (
          <article key={format.code} className={styles.courseSettingSection}>
            <div className={styles.courseSettingCopy}>
              <h4 className={styles.courseSettingTitle}>{format.label}</h4>
              <p className={styles.readOnlyNote}>
                {KIND_LABELS[format.format]} · {REVIEW_LABELS[format.reviewStatus]}
                {format.reviewStatus === "approved" && !format.active ? " · знято з продажу" : ""}
                {" · "}
                {format.mode === "lead" && format.amount === null ? "ціна за запитом" : price(format.amount)}
                {format.proposedAmount !== null ? ` · запропоновано ${price(format.proposedAmount)}` : ""}
                {format.cohortStartsOn ? ` · старт ${format.cohortStartsOn}` : ""}
              </p>
              {format.includes.length > 0 ? (
                <p className={styles.readOnlyNote}>
                  Також відкриває: {format.includes.map((program) => program.title).join(" · ")}
                </p>
              ) : null}
            </div>
            {editing === format.code ? (
              editor(format)
            ) : (
              <div className={styles.authorLinkActions}>
                <button className={styles.quietAction} type="button" onClick={() => startEdit(format)}>
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
          </article>
        ))}

        {data ? (
          editing === "new" ? (
            editor(null)
          ) : (
            <div className={styles.authorLinkActions}>
              <button className={styles.quietAction} type="button" onClick={() => startEdit(null)}>
                Додати формат
              </button>
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
