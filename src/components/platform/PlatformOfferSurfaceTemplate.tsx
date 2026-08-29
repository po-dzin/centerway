import type { ComponentProps, ReactNode } from "react";
import { LeadForm } from "@/components/platform/LeadForm";
import type { TrailStep } from "@/components/platform/PlatformTrail";
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
  /**
   * The way back to the index this page was reached from.
   *
   * Optional because not every surface has one: /consult is reached from the
   * header and from five landings, and a "back to consultations" control would
   * point at a list that does not exist.
   */
  trail?: TrailStep[];
  detailSectionId?: string;
  detailSemanticFamily: string;
  detailLeft: PanelSlot;
  detailRight: PanelSlot;
  /** Full-width sections between the detail split and the support block. */
  beforeSupport?: ReactNode;
  supportSectionId: string;
  supportLeft: PanelSlot;
  /**
   * Replaces both support panels outright.
   *
   * Exists because the closing block is the one part of an offer page that is
   * wrong in BOTH halves once the reader owns what it sells: the left panel
   * says «Відкрити доступ» to someone who has it, and the right one offers to
   * charge them again. Swapping only the right half would have left the
   * sentence beside it contradicting the button.
   *
   * A slot rather than a variant, so the template keeps knowing nothing about
   * access — the page passes a client component and stays server-rendered.
   */
  supportSlot?: ReactNode;
  /**
   * What closes the page: a lead form (`form`) or anything else (`supportRight`).
   *
   * Two slots rather than one, because the choice is not cosmetic. An offer that
   * can be bought ends in a price and a checkout button; an offer that is agreed
   * in conversation ends in a form. Passing `supportRight` wins — a page cannot
   * both sell and ask.
   */
  form?: FormConfig;
  supportRight?: ReactNode;
  boundary?: BoundaryConfig;
  /**
   * The last thing in `<main>`, after the boundary.
   *
   * For page furniture rather than content — a fixed thumb bar and the spacer
   * that keeps it off the final paragraph. Kept as a slot so the template does
   * not have to know that such a bar exists.
   */
  trailing?: ReactNode;
};

export function PlatformOfferResultList({ items }: { items: string[] }) {
  return (
    <ul className={styles.timeline}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PlatformOfferMetaList({ items }: { items: string[] }) {
  return (
    <ul className={`${styles.timeline} ${styles.programMetaList}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
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
        /* `copyNote`, not `proofNote` — see the CSS: the latter carries an icon
           column these items have nothing to put in, which squeezed the
           sentence into whatever the longest label left over. */
        <p className={styles.copyNote} key={item.id}>
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
  trail,
  detailSectionId,
  detailSemanticFamily,
  detailLeft,
  detailRight,
  beforeSupport,
  supportSectionId,
  supportLeft,
  supportSlot,
  form,
  supportRight,
  boundary,
  trailing,
}: PlatformOfferSurfaceTemplateProps) {
  return (
    <PlatformShell headerMode="overlay">
      {/* `data-cw-offer-sticky` is how the SHELL learns there is a fixed bar at
          the bottom of this page. The clearance cannot be an element inside
          `<main>`: the footer is main's sibling, so a spacer here holds the
          boundary paragraph clear and still lets the bar sit over the phone
          number. The shell owns the padding because the shell owns both. */}
      <main data-cw-detail-template={templateKind} data-cw-offer-sticky={trailing ? "true" : undefined}>
        {/* The trail is the hero's own first line now (see PlatformDetailHero):
            "where am I" belongs above the thing it locates, not in a row under
            a full-height photograph. */}
        <PlatformDetailHero {...hero} {...(trail && trail.length > 0 ? { trail } : {})} />

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

        {beforeSupport}

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="support"
          data-cw-semantic-family="support-boundary"
          data-cw-token-source="global-app-ds"
          id={supportSectionId}
        >
          <div className={styles.split}>
            {supportSlot ?? (
              <>
                <article className={styles.panel}>{renderPanel(supportLeft)}</article>
                {supportRight ??
                  (form ? (
                    <article className={styles.formPanel}>
                      <p className={styles.label}>{form.label}</p>
                      <h2 className={styles.title}>{form.title}</h2>
                      <LeadForm productCode={form.productCode} source={form.source} ctaPlace={form.ctaPlace} />
                    </article>
                  ) : null)}
              </>
            )}
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

        {trailing}
      </main>
    </PlatformShell>
  );
}
