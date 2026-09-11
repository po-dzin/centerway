"use client";

import { useToast } from "@/components/ToastProvider";

import { useCallback, useEffect, useState } from "react";

import type { Course, CourseDiff } from "@/lms-core";
import type { CourseRevisionSummary, LessonRevisionEntry } from "@/lib/lms/revisions";
import {
  createCourseRevision,
  listCourseRevisions,
  listLessonRevisions,
  loadCourseRevision,
  restoreCourseRevision,
} from "./builderClient";
import { BuilderSheet } from "./BuilderSheet";
import {
  BOUNDARY_WARNING,
  courseShape,
  describeLessonChange,
  REVISION_KIND_LABELS,
  summarizeDiff,
} from "./versionHistory";
import styles from "./Builder.module.css";

const dateTime = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function BuilderVersionHistory({
  slug,
  lessonId,
  lessonTitle,
  open,
  checkpointDisabled,
  onClose,
  onRestored,
}: {
  slug: string;
  /**
   * Сужает историю курса до одного урока.
   *
   * ФИЛЬТР, а не вторая история: снимок остаётся курсовым, отдельной таблицы
   * версий урока нет и не будет — урок не самостоятелен, и две независимые
   * истории разошлись бы на первом же переносе блока между уроками.
   */
  lessonId?: string;
  lessonTitle?: string;
  open: boolean;
  checkpointDisabled: boolean;
  onClose: () => void;
  /* Restoring advances `draft_generation`, so the document this builder is
     holding is stale the moment it succeeds. The parent must reload rather than
     let the author keep typing into a version the server will refuse. */
  onRestored: () => void;
}) {
  const [revisions, setRevisions] = useState<CourseRevisionSummary[]>([]);
  const [lessonEntries, setLessonEntries] = useState<LessonRevisionEntry[] | null>(null);
  const [selected, setSelected] = useState<(CourseRevisionSummary & { content: Course }) | null>(null);
  const [diff, setDiff] = useState<CourseDiff | null>(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const toast = useToast();

  /* Один загрузчик на оба режима: список курса и тот же список, суженный до
     урока. Две копии этой функции разошлись бы на первом же изменении
     обработки ошибки. */
  const load = useCallback(async () => {
    if (lessonId) {
      const result = await listLessonRevisions(slug, lessonId);
      setLoading(false);
      if (!result.ok) {
        toast.error("Не вдалося завантажити історію уроку.");
        return;
      }
      setLessonEntries(result.data.lessonRevisions);
      setRevisions(result.data.lessonRevisions.map((entry) => entry.revision));
      return;
    }
    const result = await listCourseRevisions(slug);
    setLoading(false);
    if (!result.ok) {
      toast.error("Не вдалося завантажити історію версій.");
      return;
    }
    setRevisions(result.data.revisions);
  }, [slug, lessonId, toast]);

  const refresh = load;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  const createCheckpoint = async () => {
    if (creating || checkpointDisabled) return;
    setCreating(true);
    const result = await createCourseRevision(slug, label.trim());
    setCreating(false);
    if (!result.ok) {
      toast.error("Не вдалося створити версію. Спробуйте ще раз.");
      return;
    }
    setLabel("");
    await refresh();
    toast.success(
      result.data.revision.created
        ? `Версію №${result.data.revision.revisionNumber} збережено.`
        : `Ця версія вже збережена — №${result.data.revision.revisionNumber}.`,
    );
  };

  const openRevision = async (revisionId: string) => {
    if (openingId) return;
    setOpeningId(revisionId);
    const result = await loadCourseRevision(slug, revisionId);
    setOpeningId(null);
    if (!result.ok) {
      toast.error("Не вдалося відкрити цю версію.");
      return;
    }
    setSelected(result.data.revision);
    setDiff(result.data.diff ?? null);
    setConfirmRestore(false);
  };

  const restore = async (revision: CourseRevisionSummary) => {
    if (restoring) return;
    setRestoring(true);
    const result = await restoreCourseRevision(slug, revision.id);
    setRestoring(false);
    if (!result.ok) {
      toast.error(
        result.detail === "lms_release_journal_migration_required"
          ? "Відновлення недоступне: журнал версій ще не увімкнено на сервері."
          : "Не вдалося відновити цю версію.",
      );
      return;
    }
    setConfirmRestore(false);
    toast.success(
      result.data.restored.staged
        ? `Версію №${revision.revisionNumber} відновлено як чернетку. Опублікований курс не змінився.`
        : `Версію №${revision.revisionNumber} відновлено.`,
    );
    onRestored();
  };

  /* Подписи для режима урока. Собираются один раз, а не считаются в разметке
     на каждый элемент списка. */
  const lessonChangeById = new Map(
    (lessonEntries ?? []).map((entry) => [entry.revision.id, describeLessonChange(entry.change)]),
  );
  const boundaryById = new Set(
    (lessonEntries ?? [])
      .filter((entry) => entry.change.kind === "changed" && entry.change.boundaryTouched)
      .map((entry) => entry.revision.id),
  );

  const shape = selected ? courseShape(selected.content) : null;

  return (
    <BuilderSheet open={open} title={lessonId ? "Історія уроку" : "Історія версій"} placement="side" onClose={onClose}>
      <div className={styles.versionHistory}>
        {lessonId ? (
          <p className={styles.fieldHint}>
            {/* Историю ведёт курс целиком; здесь она сужена до одного урока. */}
            Показано лише ті версії, у яких змінювався урок «{lessonTitle}».
          </p>
        ) : null}
        <section
          className={styles.versionCheckpoint}
          aria-labelledby="version-checkpoint-title"
          hidden={Boolean(lessonId)}
        >
          <div>
            <h3 className={styles.subTitle} id="version-checkpoint-title">
              Зберегти контрольну версію
            </h3>
            <p className={styles.fieldHint}>
              Автозбереження веде робочу копію. Тут лишаються тільки свідомі точки повернення.
            </p>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Назва, необов’язково</span>
            <input
              className={styles.input}
              type="text"
              value={label}
              maxLength={120}
              placeholder="Наприклад, структура перед запуском"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          {checkpointDisabled ? <p className={styles.fieldHint}>Дочекайтеся збереження поточних змін.</p> : null}
          <button
            className={styles.commitAction}
            type="button"
            disabled={creating || checkpointDisabled}
            onClick={() => void createCheckpoint()}
          >
            {creating ? "Зберігаємо…" : "Зберегти версію"}
          </button>
        </section>

        {selected && shape ? (
          <section className={styles.versionDetail} aria-labelledby="version-detail-title">
            <button
              className={styles.quietAction}
              type="button"
              onClick={() => {
                setSelected(null);
                setDiff(null);
              }}
            >
              До списку
            </button>
            <div>
              <span className={styles.courseMeta}>
                {REVISION_KIND_LABELS[selected.kind]} · версія №{selected.revisionNumber}
                {selected.actor ? ` · ${selected.actor}` : ""}
              </span>
              <h3 className={styles.subTitle} id="version-detail-title">
                {selected.label || selected.content.title}
              </h3>
              <time className={styles.fieldHint} dateTime={selected.createdAt}>
                {dateTime.format(new Date(selected.createdAt))}
              </time>
            </div>
            <p className={styles.panelText}>
              {shape.modules} модулів · {shape.lessons} уроків · {shape.blocks} блоків
            </p>
            {/* Чим ця версія відрізняється від того, що зараз у редакторі —
                питання перед відновленням саме таке. */}
            {diff ? (
              <>
                <p className={styles.fieldHint}>Порівняно з поточною версією: {summarizeDiff(diff)}</p>
                {diff.boundaryTouched ? (
                  <p className={styles.panelText}>
                    <strong>{BOUNDARY_WARNING}</strong>
                  </p>
                ) : null}
              </>
            ) : null}
            <ol className={styles.versionOutline}>
              {selected.content.modules.map((module) => (
                <li key={module.id}>
                  <strong>{module.title}</strong>
                  <span>{module.lessons.length} уроків</span>
                </li>
              ))}
            </ol>
            {confirmRestore ? (
              <>
                <p className={styles.fieldHint}>
                  Відновлення створює нову чернетку з цієї версії. Чинний курс залишається таким, яким його зараз бачать
                  учні, доки оновлення не пройде перевірку. Незбережені зміни в редакторі буде втрачено.
                </p>
                <button
                  className={styles.commitAction}
                  type="button"
                  disabled={restoring}
                  onClick={() => void restore(selected)}
                >
                  {restoring ? "Відновлюємо…" : `Так, відновити версію №${selected.revisionNumber}`}
                </button>
                <button
                  className={styles.quietAction}
                  type="button"
                  disabled={restoring}
                  onClick={() => setConfirmRestore(false)}
                >
                  Скасувати
                </button>
              </>
            ) : (
              <button className={styles.quietAction} type="button" onClick={() => setConfirmRestore(true)}>
                Відновити цю версію
              </button>
            )}
          </section>
        ) : (
          <section aria-labelledby="version-list-title">
            <h3 className={styles.subTitle} id="version-list-title">
              Контрольні версії
            </h3>
            {loading ? (
              <p className={styles.panelText}>Завантажуємо…</p>
            ) : revisions.length === 0 ? (
              <p className={styles.panelText}>
                {lessonId ? "Цей урок ще не змінювався в збережених версіях." : "Ще немає контрольних версій."}
              </p>
            ) : (
              <ol className={styles.versionList}>
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <button
                      className={styles.versionItem}
                      type="button"
                      disabled={openingId !== null}
                      onClick={() => void openRevision(revision.id)}
                    >
                      <span className={styles.versionItemMain}>
                        {/* В режимі уроку заголовок говорить, що сталося саме з
                            ним: назва контрольної точки тут відповідає не на те
                            питання, з яким сюди прийшли. */}
                        <strong>
                          {lessonChangeById.get(revision.id) ?? revision.label ?? REVISION_KIND_LABELS[revision.kind]}
                        </strong>
                        {/* Хто це зробив. Для перевірки «документ такий-то» без
                            «від кого» доводить половину. */}
                        <span>
                          {REVISION_KIND_LABELS[revision.kind]} · №{revision.revisionNumber}
                          {revision.actor ? ` · ${revision.actor}` : ""}
                          {boundaryById.has(revision.id) ? " · межі" : ""}
                        </span>
                      </span>
                      <time dateTime={revision.createdAt}>
                        {openingId === revision.id ? "Відкриваємо…" : dateTime.format(new Date(revision.createdAt))}
                      </time>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </BuilderSheet>
  );
}
