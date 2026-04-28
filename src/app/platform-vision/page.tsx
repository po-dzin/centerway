import "./platform-vision.css";

const routes = [
  { label: "Home", path: "/", status: "Hub", tone: "running" },
  { label: "Detox", path: "/detox", status: "Product route", tone: "success" },
  { label: "IREM", path: "/irem", status: "Product route", tone: "success" },
  { label: "Consult", path: "/consult", status: "Lead flow", tone: "pending" },
];

const programs = [
  { name: "Шлях 21", meta: "Детокс-програма", progress: "72%", token: "trust-proof" },
  { name: "IREM gymnastics", meta: "Відновлююча система", progress: "88%", token: "support" },
  { name: "Ідеальне тіло", meta: "Аюрведичний маршрут", progress: "46%", token: "policy" },
];

const tokens = [
  { name: "canvas", value: "var(--cw-bg)" },
  { name: "surface", value: "var(--cw-surface-solid)" },
  { name: "accent", value: "var(--cw-accent)" },
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

export default function PlatformVisionPage() {
  return (
    <main className="vision-shell" data-theme-family="living-mineral">
      <aside className="vision-rail" aria-label="Platform navigation">
        <div className="vision-mark" aria-label="CenterWay">
          CW
        </div>
        <nav className="vision-nav">
          <a className="is-active" href="#overview" aria-label="Overview">
            O
          </a>
          <a href="#routes" aria-label="Routes">
            R
          </a>
          <a href="#funnel" aria-label="Funnel">
            F
          </a>
          <a href="#tokens" aria-label="Tokens">
            T
          </a>
        </nav>
      </aside>

      <section className="vision-canvas" id="overview">
        <header className="vision-topbar">
          <div>
            <p className="vision-kicker">CenterWay Platform</p>
            <h1>Семантическая архитектура вместо Wix-коллажа</h1>
          </div>
          <div className="vision-actions" aria-label="Primary actions">
            <button type="button" className="vision-icon-button" aria-label="Search">
              /
            </button>
            <button type="button" className="vision-primary-button">
              Запустить миграцию
            </button>
          </div>
        </header>

        <div className="vision-grid">
          <section className="vision-hero-panel">
            <div className="vision-hero-copy">
              <p className="vision-chip">Portfolio → Product platform</p>
              <h2>Контент сохраняется, меняется слой управления.</h2>
              <p>
                Страницы Wix становятся продуктами, маршрутами, офферами, лидами и событиями.
                Визуальная система управляется ролями: surface, content, action, status, proof.
              </p>
            </div>

            <div className="vision-flow" aria-label="Migration flow">
              {funnel.map((step, index) => (
                <div className="vision-flow-step" key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="vision-map-panel" id="routes">
            <div className="vision-section-head">
              <div>
                <p className="vision-kicker">Routing layer</p>
                <h2>URL continuity</h2>
              </div>
              <span className="vision-badge">301 ready</span>
            </div>

            <div className="vision-route-list">
              {routes.map((route) => (
                <article className="vision-route" data-tone={route.tone} key={route.path}>
                  <div>
                    <strong>{route.label}</strong>
                    <span>{route.path}</span>
                  </div>
                  <em>{route.status}</em>
                </article>
              ))}
            </div>
          </section>

          <section className="vision-program-panel" id="funnel">
            <div className="vision-section-head">
              <div>
                <p className="vision-kicker">Product surfaces</p>
                <h2>Программы как управляемые продукты</h2>
              </div>
            </div>

            <div className="vision-programs">
              {programs.map((program) => (
                <article className="vision-program" data-token={program.token} key={program.name}>
                  <div>
                    <strong>{program.name}</strong>
                    <span>{program.meta}</span>
                  </div>
                  <div className="vision-meter" aria-label={`${program.name} readiness`}>
                    <span style={{ width: program.progress }} />
                  </div>
                  <small>{program.progress} migration parity</small>
                </article>
              ))}
            </div>
          </section>

          <section className="vision-mobile-panel" aria-label="Mobile product preview">
            <div className="vision-phone">
              <div className="vision-phone-bar" />
              <div className="vision-phone-hero">
                <span>IREM</span>
                <strong>Відновлююча гімнастика</strong>
              </div>
              <div className="vision-phone-stack">
                <span />
                <span />
                <span />
              </div>
              <button type="button">Обрати пакет</button>
            </div>
          </section>

          <section className="vision-token-panel" id="tokens">
            <div className="vision-section-head">
              <div>
                <p className="vision-kicker">Semantic DS</p>
                <h2>Роли токенов</h2>
              </div>
            </div>

            <div className="vision-token-grid">
              {tokens.map((token) => (
                <div className="vision-token" key={token.name}>
                  <span style={{ background: token.value }} />
                  <code>{token.name}</code>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
