"use client";

import { useLandingRuntime } from "@/components/landing/runtime/useLandingRuntime";
import type { GeneratorAnalyticsContext } from "@/lib/generator/renderContext";
import { getFunnelContent, type EthnoIconName, type FunnelRouteKey } from "@/lib/generator/content";

type BaseProps = {
  route: FunnelRouteKey;
  ctaPrimaryLabel?: string;
  generatorContext?: GeneratorAnalyticsContext;
};

const TELEGRAM_URL = "https://t.me/E_Koriakin";

function EthnoIcon({ name }: { name: EthnoIconName }) {
  if (name === "seed") {
    return (
      <svg className="cw3-ethno-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="6" r="2.2" />
        <path d="M12 9.6v9M8.8 15c.7 2 2 3.4 3.2 3.4s2.5-1.4 3.2-3.4" />
      </svg>
    );
  }

  if (name === "leaf") {
    return (
      <svg className="cw3-ethno-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19.5V8.4" />
        <path d="M12 8.5c-3.9 0-6.1-2.6-6.7-4.9 3.9.4 6.1 2.3 6.7 4.9Z" />
        <path d="M12 8.5c3.9 0 6.1-2.6 6.7-4.9-3.9.4-6.1 2.3-6.7 4.9Z" />
      </svg>
    );
  }

  if (name === "spiral") {
    return (
      <svg className="cw3-ethno-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.3 12.1c0 1.2-1 2.2-2.3 2.2S7.7 13.3 7.7 12c0-2.1 1.8-3.9 4.2-3.9 2.7 0 4.9 2.1 4.9 4.9 0 3.3-2.7 6-6.1 6-3.9 0-7.1-3.2-7.1-7.1 0-4.6 3.7-8.3 8.4-8.3" />
      </svg>
    );
  }

  if (name === "hands") {
    return (
      <svg className="cw3-ethno-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="6.2" r="1.8" />
        <path d="M7.1 15.8c1.7-1.4 2.8-3.3 3.4-5.5M16.9 15.8c-1.7-1.4-2.8-3.3-3.4-5.5" />
        <path d="M6.4 16.4c1.3 2 3.4 3.1 5.6 3.1s4.3-1.1 5.6-3.1" />
      </svg>
    );
  }

  return (
    <svg className="cw3-ethno-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.6" r="1.7" />
      <path d="M12 8.5v8.8M8.8 12.6l3.2-2.4 3.2 2.4M8.2 17.4l3.8-2.8 3.8 2.8" />
    </svg>
  );
}

function ctaClassForRoute(route: FunnelRouteKey) {
  return route === "consult" ? "js-consult-cta" : "js-detox-cta";
}

function useRouteRuntime(route: FunnelRouteKey, generatorContext?: GeneratorAnalyticsContext) {
  const map = {
    consult: {
      product: "consult" as const,
      contentName: "CenterWay Consultation",
      ctaClass: "js-consult-cta",
      ctaEventName: "ConsultCTA" as const,
    },
    detox: {
      product: "detox" as const,
      contentName: "CenterWay Detox",
      ctaClass: "js-detox-cta",
      ctaEventName: "DetoxCTA" as const,
    },
    herbs: {
      product: "herbs" as const,
      contentName: "CenterWay Herbs",
      ctaClass: "js-detox-cta",
      ctaEventName: "DetoxCTA" as const,
    },
  } as const;

  return useLandingRuntime({ ...map[route], generatorContext });
}

export function FunnelHeroSection({ route, ctaPrimaryLabel = "Записатися", generatorContext }: BaseProps) {
  const content = getFunnelContent(route);
  const ctaClass = ctaClassForRoute(route);

  useRouteRuntime(route, generatorContext);

  return (
    <section className="cw3-section cw3-screen cw3-screen-hero cw3-hero reveal" id="top">
      <div className="cw3-bg" aria-hidden="true" />
      <div className="cw3-container cw3-hero-grid">
        <div className="cw3-headline cw3-hero-content">
          <span className="cw3-eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p className="cw3-lead">{content.lead}</p>
          <aside className="cw3-panel cw3-panel-support">
            <h3>Що важливо знати одразу</h3>
            <ul className="cw3-list cw3-list-bullets">
              {content.heroHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="cw3-cta-row">
              <a className={`cw3-btn cw3-btn-primary ${ctaClass}`} data-cta-place="hero" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
                {ctaPrimaryLabel}
              </a>
            </div>
          </aside>
        </div>
        <div className="cw3-hero-media">
          <div className="cw3-photo-slot cw3-photo-slot-hero" data-photo-slot={`${route}-hero-primary`} aria-hidden="true">
            <span className="cw3-photo-slot-glyph">
              <EthnoIcon name="person" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FunnelRouteFramingSection({ route }: BaseProps) {
  const content = getFunnelContent(route);

  return (
    <section className="cw3-section cw3-screen cw3-screen-fit reveal">
      <div className="cw3-container">
        <div className="cw3-section-head">
          <h2>{content.routeTitle}</h2>
          <p>Три сценарії, де маршрут дає найбільшу практичну користь уже в першому циклі.</p>
        </div>
        <div className="cw3-grid cw3-grid-3">
          {content.routeCards.map((card) => (
            <article key={card.title} className="cw3-card cw3-card-soft">
              <div className="cw3-card-icon-slot" aria-hidden="true">
                <EthnoIcon name={card.icon} />
              </div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FunnelRouteMapSection({ route }: BaseProps) {
  const content = getFunnelContent(route);

  return (
    <section className="cw3-section cw3-screen-continue cw3-screen-fit-tail cw3-flow-cluster cw3-flow-mid reveal">
      <div className="cw3-container">
        <div className="cw3-section-head">
          <h2>{content.routeMapTitle}</h2>
          <p>{content.routeMapLead}</p>
        </div>
        <div className="cw3-grid cw3-grid-2 cw3-ecosystem-grid">
          <ol className="cw3-route-map">
            {content.routeMap.map((step) => (
              <li key={step.phase + step.title} className={`cw3-route-map-item cw3-route-map-${step.status ?? "next"}`}>
                <span className="cw3-route-map-icon" aria-hidden="true">
                  <EthnoIcon name={step.icon} />
                </span>
                <div>
                  <p className="cw3-route-map-phase">{step.phase}</p>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <article className="cw3-card cw3-card-support">
            <p className="cw3-rail-label">Екосистема</p>
            <h3>{content.nextBestRoute.title}</h3>
            <p>{content.nextBestRoute.text}</p>
            <a className="cw3-btn cw3-btn-ghost" href={content.nextBestRoute.href}>
              {content.nextBestRoute.ctaLabel}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

export function FunnelOfferDefinitionSection({ route }: BaseProps) {
  const content = getFunnelContent(route);
  const outcomesByRoute: Record<FunnelRouteKey, string[]> = {
    consult: [
      "Персональна опорна схема першого циклу з пріоритетами по ритму.",
      "Чіткі дії на найближчі 2–4 тижні без перевантаження.",
      "Зрозумілі критерії, за якими відстежуємо прогрес.",
    ],
    detox: [
      "Керований 21-денний план без різких крайнощів.",
      "Щоденний ритм з контрольними точками та корекцією навантаження.",
      "Готовий формат утримання результату після завершення циклу.",
    ],
    herbs: [
      "Стартовий трав'яний протокол з фокусом на безпеку.",
      "Схема застосування, сумісна з вашим режимом дня.",
      "Орієнтири для корекції за фактичною динамікою стану.",
    ],
  };

  return (
    <section className="cw3-section cw3-screen-continue cw3-screen-fit-tail cw3-flow-cluster cw3-flow-start reveal">
      <div className="cw3-container">
        <div className="cw3-section-head">
          <h2>{content.offerDefinition.title}</h2>
          <p>{content.offerDefinition.text}</p>
        </div>
        <div className="cw3-grid cw3-grid-2">
          <article className="cw3-card cw3-card-strong cw3-summary-card">
            <h3>Результат на виході</h3>
            <ul className="cw3-list cw3-list-bullets">
              {outcomesByRoute[route].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <div className="cw3-photo-slot cw3-photo-slot-offer" data-photo-slot={`${route}-offer-context`} aria-hidden="true">
            <span className="cw3-photo-slot-glyph">
              <EthnoIcon name="leaf" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FunnelOfferIncludesSection({ route }: BaseProps) {
  const content = getFunnelContent(route);

  return (
    <section className="cw3-section cw3-screen cw3-screen-offer cw3-flow-cluster cw3-flow-mid reveal">
      <div className="cw3-container">
        <div className="cw3-section-head">
          <h2>Що входить</h2>
          <p>Кожен елемент має чітку роль: діагностика старту, маршрут дій і супровід впровадження.</p>
        </div>
        <div className="cw3-grid cw3-grid-3 cw3-offerinclude-grid">
          {content.offerIncludeClusters.map((cluster) => (
            <article key={cluster.title} className="cw3-card cw3-card-offerinclude">
              <div className="cw3-card-icon-slot" aria-hidden="true">
                <EthnoIcon name={cluster.icon} />
              </div>
              <h3>{cluster.title}</h3>
              <ul className="cw3-list cw3-offerinclude-list">
                {cluster.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FunnelFormatPriceSection({ route, ctaPrimaryLabel = "Записатися" }: BaseProps) {
  const content = getFunnelContent(route);
  const ctaClass = ctaClassForRoute(route);

  return (
    <section className="cw3-section cw3-screen-continue cw3-screen-offer-tail cw3-flow-cluster cw3-flow-end reveal" id="price">
      <div className="cw3-container">
        <div className="cw3-pricing cw3-pricing-emphasis pricing-card" data-price-value={content.priceValue}>
          <p className="cw3-pricing-label">{content.priceLabel}</p>
          <p className="cw3-pricing-value">
            <span className="js-price-value">{content.priceValue.toLocaleString("uk-UA")}</span> грн
          </p>
          <p className="cw3-pricing-note">Фіксований стартовий формат без прихованих доплат.</p>
          <a className={`cw3-btn cw3-btn-primary ${ctaClass}`} data-cta-place="pricing" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
            {ctaPrimaryLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

export function FunnelHowItWorksSection({ route }: BaseProps) {
  const content = getFunnelContent(route);
  const titleByRoute: Record<FunnelRouteKey, string> = {
    consult: "Як проходить консультація",
    detox: "Як проходить детокс",
    herbs: "Як проходить трав'яний трек",
  };
  const leadByRoute: Record<FunnelRouteKey, string> = {
    consult: "Три послідовні кроки сесії: скринінг, діагностика і персональний план дій.",
    detox: "Три фази програми: підготовка, робочий цикл і інтеграція результату.",
    herbs: "Три фази треку: оцінка старту, схема застосування та адаптація.",
  };

  return (
    <section className="cw3-section cw3-screen cw3-screen-method cw3-section-muted cw3-flow-cluster cw3-flow-start reveal">
      <div className="cw3-container">
        <div className="cw3-section-head">
          <h2>{titleByRoute[route]}</h2>
          <p>{leadByRoute[route]}</p>
        </div>
        <ol className="cw3-timeline">
          {content.howItWorks.map((item, idx) => (
            <li key={item.title}>
              <span className="cw3-step">
                <EthnoIcon name={idx === 0 ? "seed" : idx === 1 ? "person" : "hands"} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FunnelStageBreakdownSection({ route }: BaseProps) {
  void route;
  return null;
}

export function FunnelProofSection({ route }: BaseProps) {
  const content = getFunnelContent(route);

  return (
    <section className="cw3-section cw3-screen cw3-screen-trust cw3-flow-cluster cw3-flow-start reveal">
      <div className="cw3-container">
        <div className="cw3-section-head">
          <h2>Доказовий контур маршруту</h2>
          <p>Підхід і практична реалізація пояснені прозоро, без обіцянок «універсального рішення».</p>
        </div>
      </div>
      <div className="cw3-container cw3-grid cw3-grid-2">
        {content.proof.map((item) => (
          <article key={item.title} className="cw3-card cw3-card-proof">
            <div className="cw3-photo-slot cw3-photo-slot-proof" data-photo-slot={`${route}-proof-${item.title}`} aria-hidden="true">
              <span className="cw3-photo-slot-glyph">
                <EthnoIcon name="spiral" />
              </span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      {content.quote ? (
        <div className="cw3-container cw3-proof-quote-wrap">
          <article className="cw3-card cw3-proof-quote">
            <p className="cw3-proof-quote-text">“{content.quote.text}”</p>
            <p className="cw3-proof-quote-author">— {content.quote.author}</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}

export function FunnelBoundarySection({ route }: BaseProps) {
  const content = getFunnelContent(route);

  return (
    <section className="cw3-section cw3-screen-continue cw3-screen-trust-mid cw3-flow-cluster cw3-flow-mid reveal">
      <div className="cw3-container">
        <div className="cw3-section-head">
          <h2>Межі та безпека</h2>
          <p>Це практичний маршрут підтримки. У ризикових або клінічних станах потрібен медичний супровід.</p>
        </div>
      </div>
      <div className="cw3-container cw3-grid cw3-grid-boundary">
        {content.boundary.map((item, idx) => (
          <article key={item} className="cw3-card cw3-card-boundary">
            <div className="cw3-card-icon-slot" aria-hidden="true">
              <EthnoIcon name={idx === 0 ? "hands" : idx === 1 ? "leaf" : "seed"} />
            </div>
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FunnelResourceEntrySection({ route }: BaseProps) {
  const content = getFunnelContent(route);

  return (
    <section className="cw3-section cw3-screen-continue cw3-screen-trust-mid cw3-flow-cluster cw3-flow-mid reveal">
      <div className="cw3-container">
        <article className="cw3-card cw3-card-support cw3-resource-entry">
          <div className="cw3-card-icon-slot" aria-hidden="true">
            <EthnoIcon name="spiral" />
          </div>
          <div className="cw3-resource-entry-copy">
            <p className="cw3-rail-label">Вхідний ресурс</p>
            <h3>{content.resourceEntry.title}</h3>
            <p>{content.resourceEntry.text}</p>
          </div>
          <a className="cw3-btn cw3-btn-ghost" href={content.resourceEntry.href}>
            {content.resourceEntry.ctaLabel}
          </a>
        </article>
      </div>
    </section>
  );
}

export function FunnelNextStepSection({ route, ctaPrimaryLabel = "Записатися" }: BaseProps) {
  const content = getFunnelContent(route);
  const ctaClass = ctaClassForRoute(route);

  return (
    <>
      <section className="cw3-section cw3-screen-continue cw3-screen-trust-tail cw3-next-step cw3-flow-cluster cw3-flow-end reveal">
        <div className="cw3-container">
          <div className="cw3-section-head">
            <h2>{content.nextStepTitle}</h2>
            <p>{content.nextStepText}</p>
          </div>
          <div className="cw3-card cw3-card-strong cw3-nextstep-card">
            <ul className="cw3-list cw3-nextstep-list">
              {content.nextStepChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a className={`cw3-btn cw3-btn-primary ${ctaClass}`} data-cta-place="next_step" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              {ctaPrimaryLabel}
            </a>
          </div>
        </div>
      </section>
      <footer className="cw3-footer">
        <div className="cw3-container">
          <p>{content.footerLabel}</p>
        </div>
      </footer>
      <div className="sticky-cta" id="sticky-cta" aria-hidden="true">
        <a className={`cw3-btn cw3-btn-primary ${ctaClass}`} data-cta-place="sticky" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
          {ctaPrimaryLabel}
        </a>
      </div>
    </>
  );
}

export function DoshaIntroSection() {
  return null;
}

export function DoshaRouteFramingSection() {
  return null;
}

export function DoshaNextStepSection() {
  return null;
}
