import type { ComponentProps, ReactNode } from "react";
import { LeadForm } from "@/components/platform/LeadForm";
import { PlatformDetailHero } from "@/components/platform/PlatformDetailHero";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformOfferStyles";

type HeroProps = ComponentProps<typeof PlatformDetailHero>;

type PanelSlot = {
  label: string;
  title: string;
  lead?: string;
  body?: ReactNode;
};

type FormConfig = {
  label: string;
  title: string;
  productCode: string;
  source: string;
  ctaPlace: string;
};

type BoundaryConfig = {
  label: string;
  title: string;
  lead: string;
};

type PlatformOfferSurfaceTemplateProps = {
  templateKind: "consult" | "program" | "product";
  hero: HeroProps;
  /**
   * Rendered directly under the hero, before the sales detail.
   *
   * Exists so a per-visitor notice (e.g. "you already own this") can sit above
   * the pitch without this template having to know what that notice is — the
   * template stays a server component, the slot can be a client one.
   */
  afterHero?: ReactNode;
  detailSectionId?: string;
  detailSemanticFamily: string;
  detailLeft: PanelSlot;
  detailRight: PanelSlot;
  supportSectionId: string;
  supportLeft: PanelSlot;
  form: FormConfig;
  boundary?: BoundaryConfig;
};

export function PlatformOfferResultList({ items }: { items: string[] }) {
  return (
    <ul className={`${styles.timeline} ${styles.programResultList}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PlatformOfferMetaList({ items }: { items: string[] }) {
  return (
    <div className={styles.programFormatMeta}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function PlatformOfferCopyStack({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    text: string;
  }>;
}) {
  return (
    <div className={styles.copyStack}>
      {items.map((item) => (
        <p className={styles.proofNote} key={item.id}>
          <strong>{item.title}.</strong> {item.text}
        </p>
      ))}
    </div>
  );
}

function renderPanel(panel: PanelSlot) {
  return (
    <>
      <p className={styles.label}>{panel.label}</p>
      <h2 className={styles.title}>{panel.title}</h2>
      {panel.lead ? <p className={styles.lead}>{panel.lead}</p> : null}
      {panel.body}
    </>
  );
}

export function PlatformOfferSurfaceTemplate({
  templateKind,
  hero,
  afterHero,
  detailSectionId,
  detailSemanticFamily,
  detailLeft,
  detailRight,
  supportSectionId,
  supportLeft,
  form,
  boundary,
}: PlatformOfferSurfaceTemplateProps) {
  return (
    <PlatformShell headerMode="overlay">
      <main data-cw-detail-template={templateKind}>
        <PlatformDetailHero {...hero} />

        {afterHero}

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="offer-detail"
          data-cw-semantic-family={detailSemanticFamily}
          data-cw-token-source="global-app-ds"
          id={detailSectionId}
        >
          <div className={`${styles.split} ${styles.programOfferDetailsGrid}`}>
            <article className={styles.panel}>{renderPanel(detailLeft)}</article>
            <article className={styles.panel}>{renderPanel(detailRight)}</article>
          </div>
        </section>

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="support"
          data-cw-semantic-family="support-boundary"
          data-cw-token-source="global-app-ds"
          id={supportSectionId}
        >
          <div className={styles.split}>
            <article className={styles.panel}>{renderPanel(supportLeft)}</article>
            <article className={styles.formPanel}>
              <p className={styles.label}>{form.label}</p>
              <h2 className={styles.title}>{form.title}</h2>
              <LeadForm productCode={form.productCode} source={form.source} ctaPlace={form.ctaPlace} />
            </article>
          </div>
        </section>

        {boundary ? (
          <section
            className={`${styles.container} ${styles.section}`}
            data-cw-semantic-role="boundary"
            data-cw-semantic-family="trust-boundary"
            data-cw-token-source="global-app-ds"
          >
            <article className={styles.panel}>
              <p className={styles.label}>{boundary.label}</p>
              <h2 className={styles.title}>{boundary.title}</h2>
              <p className={styles.lead}>{boundary.lead}</p>
            </article>
          </section>
        ) : null}
      </main>
    </PlatformShell>
  );
}
