import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
import templateStyles from "@/components/platform/PlatformLegalTemplate.module.css";

type LegalPanelTone = "policy" | "proof" | "support";

type LegalPanel = {
  title: string;
  body: ReactNode;
  tone?: LegalPanelTone;
};

type LegalAction = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

type PlatformLegalTemplateProps = {
  eyebrow: string;
  title: string;
  lead: string;
  panels?: LegalPanel[];
  actions?: LegalAction[];
  children?: ReactNode;
  shellMode?: "platform" | "plain";
};

function LegalContent({ eyebrow, title, lead, panels = [], actions = [], children }: Omit<PlatformLegalTemplateProps, "shellMode">) {
  return (
    <main className={`${templateStyles.page} ${styles.section}`}>
      <div className={`${styles.container} ${templateStyles.stack}`}>
        <article className={styles.panel}>
          <p className={styles.label}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </article>

        {panels.length > 0 ? (
          <div className={styles.grid2}>
            {panels.map((panel) => (
              <section className={styles.card} data-tone={panel.tone ?? "policy"} key={panel.title}>
                <h2>{panel.title}</h2>
                {panel.body}
              </section>
            ))}
          </div>
        ) : null}

        {children}

        {actions.length > 0 ? (
          <section className={templateStyles.actions}>
            {actions.map((action) => (
              <Link
                className={action.tone === "secondary" ? templateStyles.actionSecondary : templateStyles.actionPrimary}
                href={action.href}
                key={`${action.href}:${action.label}`}
              >
                {action.label}
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

export function PlatformLegalTemplate(props: PlatformLegalTemplateProps) {
  const { shellMode, ...contentProps } = props;

  if (shellMode === "plain") {
    return <LegalContent {...contentProps} />;
  }

  return (
    <PlatformShell>
      <LegalContent {...contentProps} />
    </PlatformShell>
  );
}
