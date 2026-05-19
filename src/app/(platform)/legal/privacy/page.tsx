import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
import { contact, legal } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Політика конфіденційності - CenterWay",
  description: "Політика конфіденційності CenterWay: збір, використання та захист персональних даних.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <PlatformShell>
      <main className={`${styles.container} ${styles.section}`}>
        <article className={styles.panel}>
          <p className={styles.label}>Privacy</p>
          <h1 className={styles.title}>Політика конфіденційності</h1>
          <p className={styles.lead}>{legal.privacy}</p>
          <div className={styles.grid2}>
            <section className={styles.card} data-tone="proof">
              <h2>Які дані збираються</h2>
              <p>
                Ім&apos;я, телефон, email, коментар, обраний інтерес, технічні дані сторінки, UTM-мітки та дані, необхідні для обробки заявок або оплат.
              </p>
            </section>
            <section className={styles.card} data-tone="policy">
              <h2>Як зв’язатися</h2>
              <p>
                З питань персональних даних напишіть на {contact.email} або зв’яжіться за телефоном {contact.phone}.
              </p>
            </section>
          </div>
        </article>
      </main>
    </PlatformShell>
  );
}
