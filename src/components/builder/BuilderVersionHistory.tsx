"use client";

import { useToast } from "@/components/ToastProvider";

import { useCallback, useEffect, useState } from "react";

import type { Course } from "@/lms-core";
import type { CourseRevisionSummary } from "@/lib/lms/revisions";
import { createCourseRevision, listCourseRevisions, loadCourseRevision } from "./builderClient";
import { BuilderSheet } from "./BuilderSheet";
import { courseShape, REVISION_KIND_LABELS } from "./versionHistory";
import styles from "./Builder.module.css";

const dateTime = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function BuilderVersionHistory({
  slug,
  open,
  checkpointDisabled,
  onClose,
}: {
  slug: string;
  open: boolean;
  checkpointDisabled: boolean;
  onClose: () => void;
}) {
  const [revisions, setRevisions] = useState<CourseRevisionSummary[]>([]);
  const [selected, setSelected] = useState<(CourseRevisionSummary & { content: Course }) | null>(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const toast = useToast();

  const refresh = useCallback(async () => {
    const result = await listCourseRevisions(slug);
    setLoading(false);
    if (!result.ok) {
      toast.error("Не вдалося завантажити історію версій.");
      return;
    }
    setRevisions(result.data.revisions);
  }, [slug, toast]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await listCourseRevisions(slug);
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        toast.error("Не вдалося завантажити історію версій.");
        return;
      }
      setRevisions(result.data.revisions);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, slug, toast]);

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
    toast.success(`Версію №${result.data.revision.revisionNumber} збережено.`);
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
  };

  const shape = selected ? courseShape(selected.content) : null;

  return (
    <BuilderSheet open={open} title="Історія версій" placement="side" onClose={onClose}>
      <div className={styles.versionHistory}>
        <section className={styles.versionCheckpoint} aria-labelledby="version-checkpoint-title">
          <div>
            <h3 className={styles.subTitle} id="version-checkpoint-title">Зберегти контрольну версію</h3>
            <p className={styles.fieldHint}>Автозбереження веде робочу копію. Тут лишаються тільки свідомі точки повернення.</p>
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
            <button className={styles.quietAction} type="button" onClick={() => setSelected(null)}>До списку</button>
            <div>
              <span className={styles.courseMeta}>{REVISION_KIND_LABELS[selected.kind]} · версія №{selected.revisionNumber}</span>
              <h3 className={styles.subTitle} id="version-detail-title">{selected.label || selected.content.title}</h3>
              <time className={styles.fieldHint} dateTime={selected.createdAt}>{dateTime.format(new Date(selected.createdAt))}</time>
            </div>
            <p className={styles.panelText}>{shape.modules} модулів · {shape.lessons} уроків · {shape.blocks} блоків</p>
            <ol className={styles.versionOutline}>
              {selected.content.modules.map((module) => (
                <li key={module.id}>
                  <strong>{module.title}</strong>
                  <span>{module.lessons.length} уроків</span>
                </li>
              ))}
            </ol>
            <p className={styles.fieldHint}>Відновлення з історії з’явиться після атомарного серверного restore: стара версія ніколи не підмінятиме чинний курс частково.</p>
          </section>
        ) : (
          <section aria-labelledby="version-list-title">
            <h3 className={styles.subTitle} id="version-list-title">Контрольні версії</h3>
            {loading ? <p className={styles.panelText}>Завантажуємо…</p> : revisions.length === 0 ? (
              <p className={styles.panelText}>Ще немає контрольних версій.</p>
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
                        <strong>{revision.label || REVISION_KIND_LABELS[revision.kind]}</strong>
                        <span>{REVISION_KIND_LABELS[revision.kind]} · №{revision.revisionNumber}</span>
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
