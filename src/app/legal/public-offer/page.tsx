import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformStyles";
import { contact, legal } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Публічний договір - CenterWay",
  description: "Публічна оферта CenterWay щодо цифрових онлайн-продуктів, консультацій та супутніх сервісів.",
  alternates: { canonical: "/legal/public-offer" },
};

export default function PublicOfferPage() {
  return (
    <PlatformShell>
      <main className={`${styles.container} ${styles.section}`}>
        <article className={styles.panel}>
          <p className={styles.label}>Legal</p>
          <h1 className={styles.title}>Публічний договір</h1>
          <p className={styles.lead}>{legal.publicOffer}</p>
          <div className={styles.grid2}>
            <section className={styles.card} data-tone="policy">
              <h2>Предмет договору</h2>
              <p>
                CenterWay надає доступ до цифрових матеріалів, онлайн-програм, консультацій та супутніх інформаційних сервісів, розміщених на сайті та піддоменах.
              </p>
            </section>
            <section className={styles.card} data-tone="support">
              <h2>Контакти продавця</h2>
              <p>
                Email: {contact.email}
                <br />
                Телефон: {contact.phone}
                <br />
                Сайт: https://centerway.net.ua
              </p>
            </section>
          </div>
        </article>
      </main>
    </PlatformShell>
  );
}
