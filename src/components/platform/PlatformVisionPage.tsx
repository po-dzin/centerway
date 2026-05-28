import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformSurfaceStyles";
import visionStyles from "@/components/platform/PlatformVisionPage.module.css";

const routes = [
  { label: "Home", path: "/", status: "Hub", tone: "running" as const },
  { label: "Detox", path: "/detox", status: "Canonical alias", tone: "success" as const },
  { label: "IREM", path: "/irem", status: "Product route", tone: "success" as const },
  { label: "Consult", path: "/consult", status: "Lead flow", tone: "pending" as const },
];

const programs = [
  { name: "Шлях 21", meta: "Детокс-програма", progress: "72%" },
  { name: "IREM gymnastics", meta: "Відновлююча система", progress: "88%" },
  { name: "Ідеальне тіло", meta: "Аюрведичний маршрут", progress: "46%" },
];

const tokens = [
  { name: "canvas", value: "var(--cw-platform-bg)" },
  { name: "surface", value: "var(--cw-platform-surface)" },
  { name: "accent", value: "var(--cw-platform-accent)" },
  { name: "success", value: "var(--cw-status-success)" },
  { name: "pending", value: "var(--cw-status-pending)" },
  { name: "proof", value: "var(--cw-role-trust-proof-surface)" },
];

const funnel = [
  "Wix URL intake",
  "Semantic content model",
  "Product checkout",
  "Lead + analytics",
  "Admin governance",
];

export function PlatformVisionPage() {
  return (
    <PlatformShell headerMode="overlay">
      <main
        className={visionStyles.page}
        data-cw-platform-template="vision"
        data-cw-semantic-role="orientation"
        data-cw-semantic-family="route-proof"
        data-cw-token-source="global-app-ds"
      >
        <div className={`${styles.container} ${visionStyles.stack}`}>
          <section className={visionStyles.hero}>
            <article className={styles.panel}>
              <div className={visionStyles.heroHeader}>
                <div>
                  <p className={visionStyles.eyebrow}>CenterWay Platform</p>
                  <h1>Семантична архітектура замість Wix-колажу</h1>
                </div>
                <div className={visionStyles.heroActions}>
                  <Link className={styles.secondaryButton} href="#routes">
                    Подивитися маршрути
                  </Link>
                  <Link className={styles.primaryButton} href="/programs">
                    Відкрити платформу
                  </Link>
                </div>
              </div>
              <p className={visionStyles.heroLead}>
                Контент зберігається, але шар управління стає керованим: сторінки Wix перетворюються на продукти,
                маршрути, оффери, ліди й події. Візуальна система працює через ролі surface, content, action, status
                і proof замість локальних page-level рішень.
              </p>
            </article>

            <div className={visionStyles.heroGrid}>
              <article className={`${styles.panel} ${visionStyles.flowCard}`}>
                <p className={visionStyles.eyebrow}>Migration flow</p>
                <div className={visionStyles.flowList}>
                  {funnel.map((step, index) => (
                    <div className={visionStyles.flowItem} key={step}>
                      <span className={visionStyles.flowIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <div className={visionStyles.flowText}>
                        <strong>{step}</strong>
                        <span>Кожен крок стає частиною типізованого runtime contract, а не окремою ручною сторінкою.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className={`${styles.panel} ${visionStyles.phoneCard}`} aria-label="Mobile product preview">
                <div className={visionStyles.phoneMock}>
                  <div className={visionStyles.phoneBar} />
                  <div className={visionStyles.phoneHero}>
                    <span>IREM</span>
                    <strong>Відновлююча гімнастика</strong>
                  </div>
                  <div className={visionStyles.phoneStack}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={visionStyles.phoneButton}>Обрати пакет</div>
                </div>
              </article>
            </div>
          </section>

          <section className={visionStyles.grid} id="routes">
            <article className={styles.panel}>
              <div className={visionStyles.sectionHeader}>
                <div>
                  <p className={visionStyles.eyebrow}>Routing layer</p>
                  <h2>URL continuity</h2>
                </div>
                <span className={visionStyles.badge}>301 ready</span>
              </div>
              <div className={visionStyles.routeList}>
                {routes.map((route) => (
                  <article className={visionStyles.routeItem} key={route.path}>
                    <div className={visionStyles.routeBody}>
                      <strong>{route.label}</strong>
                      <span>{route.path}</span>
                    </div>
                    <span className={visionStyles.routeStatus} data-tone={route.tone}>
                      {route.status}
                    </span>
                  </article>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={visionStyles.sectionHeader}>
                <div>
                  <p className={visionStyles.eyebrow}>Product surfaces</p>
                  <h2>Програми як керовані продукти</h2>
                </div>
              </div>
              <div className={visionStyles.programList}>
                {programs.map((program) => (
                  <article className={visionStyles.programItem} key={program.name}>
                    <div className={visionStyles.programBody}>
                      <strong>{program.name}</strong>
                      <span>{program.meta}</span>
                    </div>
                    <div aria-label={`${program.name} readiness`} className={visionStyles.meter}>
                      <span style={{ width: program.progress }} />
                    </div>
                    <p className={styles.proofNote}>{program.progress} migration parity</p>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section id="tokens">
            <article className={styles.panel}>
              <div className={visionStyles.sectionHeader}>
                <div>
                  <p className={visionStyles.eyebrow}>Semantic DS</p>
                  <h2>Ролі токенів</h2>
                </div>
              </div>
              <div className={visionStyles.tokenGrid}>
                {tokens.map((token) => (
                  <article className={visionStyles.tokenItem} key={token.name}>
                    <span className={visionStyles.tokenSwatch} style={{ background: token.value }} />
                    <code>{token.name}</code>
                  </article>
                ))}
              </div>
            </article>
          </section>
        </div>
      </main>
    </PlatformShell>
  );
}
