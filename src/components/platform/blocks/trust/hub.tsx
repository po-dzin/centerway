import styles from "@/components/platform/PlatformContentStyles";
import { naturalSupportItems, proofItems } from "@/lib/platform/content";

export function HubSupport() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="support-nature">
      <article className={styles.panel}>
        <div className={styles.panelStack}>
          <div className={styles.supportPanelLayout}>
            <div className={styles.panelIntro}>
              <h2 className={styles.title}>Природна підтримка процесу</h2>
            </div>
            <div className={styles.herbVisual} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className={`${styles.grid3} ${styles.relaxedGrid}`}>
            {naturalSupportItems.map((item) => (
              <p className={styles.proofNote} key={item}>{item}</p>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

export function HubProof() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="stories">
      <article className={styles.panel}>
        <div className={styles.panelStack}>
          <div className={styles.panelIntro}>
            <h2 className={styles.title}>Реальні зміни проходять як процес</h2>
          </div>
          <div className={`${styles.grid3} ${styles.relaxedGrid}`}>
            {proofItems.map((item) => (
              <p className={styles.proofNote} key={item}>{item}</p>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
