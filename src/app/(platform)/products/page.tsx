import type { Metadata } from "next";
import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
import { platformProductOffers } from "@/lib/platform/content";

function ProductCard({
  title,
  tag,
  description,
  href,
  visual,
}: {
  title: string;
  tag: string;
  description: string;
  href: string;
  visual: string;
}) {
  return (
    <article className={styles.programTile} data-visual={visual}>
      <div className={styles.programPhoto} aria-hidden="true" />
      <div className={styles.programTileBody}>
        <p className={styles.label}>{tag}</p>
        <h3>{title}</h3>
        <p>{description}</p>
        <Link className={styles.programLink} href={href}>
          Деталі продукту
        </Link>
      </div>
    </article>
  );
}

export const metadata: Metadata = {
  title: "Продукти CenterWay",
  description: "Трав'яна та природна підтримка CenterWay: як обирати продукти в контексті стану, ритму, програм і меж методу.",
  alternates: { canonical: "/products" },
};

export default function ProductsIndexPage() {
  return (
    <PlatformShell>
      <main>
        <section
          className={`${styles.container} ${styles.hero}`}
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-trust"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.heroPanel}>
            <div>
              <p className={styles.eyebrow}>Природна підтримка</p>
              <h1 className={styles.heroTitle}>Продукти CenterWay</h1>
            </div>
            <p className={styles.lead}>
              Тут зібрані не програми, а окремі засоби підтримки: трави та інші продуктові формати, які мають сенс тільки в контексті стану, харчування, ритму і загального маршруту відновлення.
            </p>
            <div className={styles.heroFooter}>
              <Link className={styles.primaryButton} href="/dosha-test">
                Почати з діагностики
              </Link>
              <Link className={styles.secondaryButton} href="/programs">
                Перейти до програм
              </Link>
            </div>
          </div>
          <article className={styles.panel}>
            <p className={styles.label}>Принцип відбору</p>
            <ul className={styles.timeline}>
              <li>продукт не підміняє діагностику і не подається як універсальна відповідь;</li>
              <li>спочатку важлива придатність: кому це може підійти, а кому краще почати з тесту або консультації;</li>
              <li>кожна product page має пояснювати межі очікувань і зв&apos;язок з програмами, а не дублювати лендинг.</li>
            </ul>
          </article>
        </section>

        <section
          className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.label}>Каталог</p>
              <h2 className={styles.sectionTitle}>Що вже доступно</h2>
            </div>
          </div>
          <div className={styles.programShowcase} data-layout="mini">
            {platformProductOffers.map((product) => (
              <ProductCard
                key={product.slug}
                title={product.title}
                tag={product.tag}
                description={product.description}
                href={product.href}
                visual={product.visual}
              />
            ))}
          </div>
        </section>
      </main>
    </PlatformShell>
  );
}
