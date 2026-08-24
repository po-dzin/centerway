import styles from "./Builder.module.css";

/** Boundary/recovery surface for a durable draft based on an older generation. */
export function BuilderDraftConflict({
  onRecover,
  onDiscard,
}: {
  onRecover: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className={styles.panel} aria-labelledby="builder-draft-conflict-title">
      <h2 className={styles.panelTitle} id="builder-draft-conflict-title">
        Знайдено локальні зміни
      </h2>
      <p className={styles.panelText}>
        Серверна версія змінилася в іншій вкладці. Локальна копія не втрачена й не буде накладена без вашого вибору.
      </p>
      <div className={styles.panelActions}>
        <button className={styles.commitAction} type="button" onClick={onRecover}>
          Відновити локальну
        </button>
        <button className={styles.quietAction} type="button" onClick={onDiscard}>
          Залишити серверну
        </button>
      </div>
    </section>
  );
}
