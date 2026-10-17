import Link from "next/link";

import { Icon } from "@/components/Icon";
import { LEAD_FORM_ANCHOR, LeadForm } from "@/components/platform/LeadForm";
import { consultationSteps } from "@/components/platform/consultPageContract";
import type { Author } from "@/lms-core";
import styles from "./AuthorConsultation.module.css";

/**
 * AN AUTHOR'S CONSULTATION, AND THE ONE PLACE TO ASK FOR IT (2026-10-16).
 *
 * `/consult` used to end in a form that filed every request as «consult» with
 * nobody's name on it — right while there was one author, wrong from the
 * second. And this block, on the author's own page, had only the author's
 * external link: a reader whose author left it empty had no way to ask at all.
 *
 * So the request moved here, where the person is already chosen, and the form
 * carries the author's slug. The author's external link is NOT printed: a
 * conversation that moves to someone's private messages is one the platform
 * can no longer see — not the agreement, not the payment, not the author's
 * share. The link is still kept on the profile and travels with the request to
 * the team, so arranging the time can use it.
 *
 * The boundary and the questions live once, on `/consult`; this block links
 * there instead of repeating them under every author.
 */
export function AuthorConsultation({ author }: { author: Author }) {
  const consultation = author.consultation;
  if (!consultation?.enabled) return null;

  return (
    <section
      className={styles.consultation}
      id="consultation"
      data-cw-semantic-role="offer"
      data-cw-semantic-family="support-boundary"
      data-cw-token-source="global-app-ds"
      data-cw-user-question="Як попросити консультацію в цього автора?"
      data-cw-route-boundary="platform:/expert/[slug]"
    >
      <div className={styles.copy}>
        <p className={styles.label}>Консультація</p>
        {/* The author's own title when they wrote one: their word for what
            they offer is a better heading than the platform's. */}
        <h2 className={styles.title}>{consultation.title || `Консультація з ${author.name}`}</h2>
        {consultation.summary ? <p className={styles.summary}>{consultation.summary}</p> : null}
        {consultation.points?.length ? (
          <ul className={styles.points}>
            {consultation.points.map((point) => (
              <li key={point}>
                <Icon name="check" size={18} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <ol className={styles.steps}>
          {consultationSteps.map((step, index) => (
            <li key={step.id}>
              <span className={styles.stepMark} aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <strong>{step.title}</strong>
                <span className={styles.stepText}>{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.more}>
          Межі формату і питання —{" "}
          <Link className="cw-link-rule" href="/consult#consult-faq">
            на сторінці консультацій
          </Link>
          .
        </p>
      </div>

      {/* The anchor is the panel, not the button: a reader arriving from the
          hub's «Записатися» lands on the heading above the open fields. */}
      <div className={styles.request} id={LEAD_FORM_ANCHOR}>
        <h3 className={styles.requestTitle}>Запит на консультацію</h3>
        <p className={styles.requestLead}>Кілька рядків про те, що турбує. Ми напишемо вам і узгодимо час.</p>
        <LeadForm
          productCode="consult"
          source="platform_author_consult"
          ctaPlace="author_consultation"
          authorSlug={author.slug}
          collapsed
        />
      </div>
    </section>
  );
}
