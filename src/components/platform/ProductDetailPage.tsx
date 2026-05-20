import Link from "next/link";
import { LeadForm } from "@/components/platform/LeadForm";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
import type { programs } from "@/lib/platform/content";

type Product = (typeof programs)[number];

export function ProductDetailPage({ product }: { product: Product }) {
  return (
    <PlatformShell>
      <main>
        <section
          className={`${styles.container} ${styles.hero}`}
          data-cw-semantic-role="offer-orientation"
          data-cw-semantic-family="guide-trust"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.heroPanel}>
            <div>
              <p className={styles.eyebrow}>{product.tag}</p>
              <h1 className={styles.heroTitle}>{product.fullTitle}</h1>
            </div>
            <p className={styles.lead}>{product.longDescription}</p>
            <div className={styles.heroFooter}>
              <Link className={styles.primaryButton} href={product.funnelHref}>
                Перейти до замовлення
              </Link>
              <Link className={styles.secondaryButton} href="/products">
                Усі продукти
              </Link>
            </div>
          </div>
          <aside className={styles.programTile} data-visual={product.visual}>
            <div className={styles.programPhoto} aria-hidden="true" />
            <div className={styles.programTileBody}>
              <p className={styles.label}>{product.duration}</p>
              <h3>{product.title}</h3>
              <p>{product.description}</p>
            </div>
          </aside>
        </section>

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="offer-detail"
          data-cw-semantic-family="method-trust"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.split}>
            <article className={styles.panel}>
              <p className={styles.label}>Коли це доречно</p>
              <h2 className={styles.title}>Продукт не існує поза контекстом стану</h2>
              <ul className={styles.timeline}>
                {product.results.map((result) => (
                  <li key={result}>{result}</li>
                ))}
              </ul>
            </article>
            <article className={styles.panel}>
              <p className={styles.label}>Як входити</p>
              <h2 className={styles.title}>Три коректні сценарії входу</h2>
              <ul className={styles.timeline}>
                <li>через окрему сторінку замовлення, якщо вже зрозуміло, що потрібна саме ця підтримка;</li>
                <li>через тест доши, якщо важливо спочатку зрозуміти стан, ритм і тип навантаження;</li>
                <li>через консультацію, якщо потрібен живий підбір і межі методу мають бути проговорені окремо.</li>
              </ul>
            </article>
          </div>
        </section>

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="support"
          data-cw-semantic-family="support-boundary"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.split}>
            <article className={styles.panel}>
              <p className={styles.label}>Підбір</p>
              <h2 className={styles.title}>Запит на підбір природної підтримки</h2>
              <p className={styles.lead}>
                Ця сторінка не підміняє діагностику і не робить вигляд, що банку можна обрати без контексту. Залиште запит, якщо хочете пройти через підбір, а не випадкову покупку.
              </p>
            </article>
            <article className={styles.formPanel}>
              <p className={styles.label}>Форма</p>
              <h2 className={styles.title}>Підібрати підтримку</h2>
              <LeadForm productCode={product.slug} source={`platform_${product.slug}_form`} ctaPlace={`${product.slug}_product_page`} />
            </article>
          </div>
        </section>

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="boundary"
          data-cw-semantic-family="trust-boundary"
          data-cw-token-source="global-app-ds"
        >
          <article className={styles.panel}>
            <p className={styles.label}>Межі методу</p>
            <h2 className={styles.title}>Не лікування і не заміна медичної консультації</h2>
            <p className={styles.lead}>
              Трав&apos;яна підтримка CenterWay описується як wellness-продукт усередині більшої системи ритму, харчування і практики. Вона не замінює лікаря, діагностику або медикаментозне лікування, особливо при гострих станах, вагітності, хронічних захворюваннях чи постійній терапії.
            </p>
          </article>
        </section>
      </main>
    </PlatformShell>
  );
}
