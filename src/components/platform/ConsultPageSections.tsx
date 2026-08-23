import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformTrustStyles";
import { consultationBoundary, consultationFaq } from "@/components/platform/consultPageContract";

export function ConsultBoundary() {
  return (
    <section
      className={`${styles.container} ${styles.section}`}
      data-cw-semantic-role="boundary"
      data-cw-semantic-family="trust-boundary"
      data-cw-token-source="global-app-ds"
      data-cw-user-question="Чим консультація не є і коли потрібен лікар?"
      data-cw-route-boundary="platform:/consult"
      id="consult-boundary"
    >
      <article className={styles.panel}>
        <p className={styles.label}>Межі формату</p>
        <h2 className={styles.title}>{consultationBoundary.title}</h2>
        <p className={styles.lead}>{consultationBoundary.text}</p>
      </article>
    </section>
  );
}

export function ConsultFaq() {
  return (
    <section
      className={`${styles.container} ${styles.section}`}
      data-cw-semantic-role="expectation"
      data-cw-semantic-family="trust-support"
      data-cw-token-source="global-app-ds"
      data-cw-user-question="Що варто знати перед запитом?"
      data-cw-route-boundary="platform:/consult"
      id="consult-faq"
    >
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.label}>Питання й відповіді</p>
          <h2 className={styles.sectionTitle}>Що варто знати перед зустріччю</h2>
        </div>
      </div>
      <div className={styles.copyStack}>
        {consultationFaq.map((item) => (
          <details className={styles.collapsibleBlock} key={item.id}>
            <summary className={styles.collapsibleSummary}>
              <span>{item.question}</span>
              <Icon name="chevron-down" size={18} className={styles.collapsibleMarker} />
            </summary>
            <article className={styles.panel}>
              <p className={styles.lead}>{item.answer}</p>
            </article>
          </details>
        ))}
      </div>
    </section>
  );
}
