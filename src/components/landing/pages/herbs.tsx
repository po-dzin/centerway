"use client";

/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
import { useLandingRuntime } from "@/components/landing/runtime/useLandingRuntime";
import type { GeneratorAnalyticsContext } from "@/lib/generator/renderContext";

type HerbsLandingPageProps = {
  ctaPrimaryLabel?: string;
  generatorContext?: GeneratorAnalyticsContext;
};

export function HerbsLandingPage({ ctaPrimaryLabel = "Записатися", generatorContext }: HerbsLandingPageProps) {
  useLandingRuntime({
    product: "herbs",
    contentName: "CenterWay Herbs",
    ctaClass: "js-detox-cta",
    ctaEventName: "DetoxCTA",
    generatorContext,
  });

  return (
    <>
      <div className="bg-noise" aria-hidden="true"></div>
          <div className="cw-bg-atmosphere" aria-hidden="true"></div>
      
          <header className="hero section" id="top">
            <div className="container reveal">
              <div className="hero-headline">
                <span className="eyebrow">CENTERWAY HERBS</span>
                <h1>М'яке перезавантаження харчування та ритму <span className="accent">за 21 день</span></h1>
                <p className="lead">
                  Це практична програма для тих, хто хоче зменшити перевантаження в харчуванні,
                  стабілізувати енергію та повернути зрозумілий ритм без радикальних обмежень.
                </p>
              </div>
      
              <div className="hero-card role-proof-card">
                <h2>Що важливо знати одразу</h2>
                <ul className="bullet-list">
                  <li>Тривалість: 21 день у вашому темпі.</li>
                  <li>Формат: онлайн, з супроводом у Telegram.</li>
                  <li>Результат: покроковий план + меню + чеклісти щоденного застосування.</li>
                </ul>
                <a
                  className="btn btn-primary js-detox-cta"
                  data-cta-place="hero"
                  href="https://t.me/E_Koriakin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ctaPrimaryLabel}
                </a>
                <a
                  className="btn btn-ghost js-detox-cta"
                  data-cta-place="hero_question"
                  href="https://t.me/E_Koriakin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Поставити запитання
                </a>
              </div>
            </div>
          </header>
      
          <main>
            <section className="section">
              <div className="container reveal">
                <h2>Кому підходить програма</h2>
                <div className="grid grid-3">
                  <article className="role-support-card card">
                    <span className="card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 4.5v7"></path>
                        <path d="M10 4.5v7"></path>
                        <path d="M8.5 11.5v8"></path>
                        <path d="M15.8 4.8c-1.2 1.2-1.8 2.8-1.8 4.6v10.1"></path>
                        <path d="M14 11.6h3.6"></path>
                      </svg>
                    </span>
                    <h3>Хаотичне харчування</h3>
                    <p>Якщо день проходить без структури, а їжа стає реакцією на стрес та втому.</p>
                  </article>
                  <article className="role-support-card card">
                    <span className="card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="11.4" r="6.7"></circle>
                        <path d="M12 8.2v3.4l2.4 1.6"></path>
                        <path d="M8.2 18.2h7.6"></path>
                      </svg>
                    </span>
                    <h3>Перевантаження системи</h3>
                    <p>Якщо є тяжкість після їжі, нестабільна енергія та відчуття «збитого» ритму.</p>
                  </article>
                  <article className="role-support-card card">
                    <span className="card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 4.2v15.6"></path>
                        <path d="M5.6 10.5 12 4.2l6.4 6.3"></path>
                        <path d="M7.3 18.4h9.4"></path>
                      </svg>
                    </span>
                    <h3>Потреба в перезапуску</h3>
                    <p>Якщо потрібен м'який перехід до зрозумілих звичок без крайнощів і заборон.</p>
                  </article>
                </div>
              </div>
            </section>
      
            <section className="section section-muted">
              <div className="container reveal">
                <h2>Типові запити</h2>
                <div className="grid grid-2">
                  <ul className="bullet-list role-practice-card card">
                    <li>Втома після прийомів їжі.</li>
                    <li>Нерівний апетит і тяга до солодкого ввечері.</li>
                    <li>Відчуття набряклості та повільного відновлення.</li>
                  </ul>
                  <ul className="bullet-list role-practice-card card">
                    <li>Порушений режим сну та підйому.</li>
                    <li>Складність тримати стабільний раціон у робочому графіку.</li>
                    <li>Потреба в системі, яку реально впровадити в побуті.</li>
                  </ul>
                </div>
              </div>
            </section>
      
            <section className="section">
              <div className="container reveal">
                <h2>Що ви отримаєте</h2>
                <div className="grid grid-2">
                  <article className="role-path-card card">
                    <h3>План на 21 день</h3>
                    <p>Покрокова структура: що робити щотижня і як адаптувати під ваш ритм.</p>
                  </article>
                  <article className="role-path-card card">
                    <h3>Раціон і базові протоколи</h3>
                    <p>Практичні принципи харчування та прості щоденні алгоритми підтримки травлення.</p>
                  </article>
                  <article className="role-path-card card">
                    <h3>Checklist самоспостереження</h3>
                    <p>Показники для відстеження змін у самопочутті без зайвого когнітивного шуму.</p>
                  </article>
                  <article className="role-path-card card">
                    <h3>Супровід у Telegram</h3>
                    <p>Можливість ставити уточнюючі питання щодо впровадження рекомендацій.</p>
                  </article>
                </div>
              </div>
            </section>
      
            <section className="section section-muted">
              <div className="container reveal">
                <h2>Як проходить програма</h2>
                <ol className="timeline role-method-card">
                  <li>
                    <span className="step-index">1</span>
                    <div>
                      <h3>Підготовка (1-2 дні)</h3>
                      <p>Стартовий бриф, узгодження цілей та адаптація програми під ваш графік.</p>
                    </div>
                  </li>
                  <li>
                    <span className="step-index">2</span>
                    <div>
                      <h3>Основний цикл (14 днів)</h3>
                      <p>Впровадження раціону, ритму дня і практичних кроків відновлення.</p>
                    </div>
                  </li>
                  <li>
                    <span className="step-index">3</span>
                    <div>
                      <h3>Інтеграція (5-6 днів)</h3>
                      <p>Закріплення звичок та план переходу до підтримуючого режиму.</p>
                    </div>
                  </li>
                </ol>
              </div>
            </section>
      
            <section className="section">
              <div className="container reveal">
                <h2>Хто веде програму</h2>
                <article className="bio-card role-proof-card">
                  <h3>Євгеній Корякін (CenterWay)</h3>
                  <p>
                    Практик аюрведи та тілесних систем. Фокус програми: дати реалістичну структуру
                    харчування і ритму, яку можна підтримувати в реальному житті.
                  </p>
                </article>
              </div>
            </section>
      
            <section className="section section-pricing" id="price">
              <div className="container reveal">
                <h2>Формат і вартість</h2>
                <div className="pricing-card role-pricing-card" data-price-value="3600">
                  <div className="pricing-main">
                    <p className="pricing-label">Herbs Entry</p>
                    <p className="pricing-value"><span className="js-price-value">3 600</span> грн</p>
                  </div>
                  <ul className="bullet-list">
                    <li>Тривалість: 21 день.</li>
                    <li>Формат: онлайн, супровід у Telegram.</li>
                    <li>Матеріали: план, меню, checklist, відповіді на питання по ходу програми.</li>
                  </ul>
                  <a
                    className="btn btn-primary js-detox-cta"
                    data-cta-place="pricing"
                    href="https://t.me/E_Koriakin"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {ctaPrimaryLabel}
                  </a>
                </div>
              </div>
            </section>
      
            <section className="section section-boundary">
              <div className="container reveal">
                <h2>Прозоро й безпечно</h2>
                <div className="boundary-grid role-trust-note">
                  <p>
                    Програма є освітньо-практичним супроводом і не замінює медичну допомогу.
                    За наявності медичних станів або ризиків рекомендовано звернутися до профільного лікаря.
                  </p>
                  <p>
                    Ми не даємо гарантій лікування чи універсальних результатів.
                    Ефект залежить від вихідного стану, регулярності виконання та базового способу життя.
                  </p>
                </div>
              </div>
            </section>
      
            <section className="section">
              <div className="container reveal">
                <h2>FAQ</h2>
                <div className="faq-list">
                  <details>
                    <summary>Чи підходить програма новачкам?</summary>
                    <p>Так. Всі кроки подані від базового рівня і не потребують попереднього досвіду.</p>
                  </details>
                  <details>
                    <summary>Коли очікувати перші зміни в самопочутті?</summary>
                    <p>Зазвичай перші зміни помітні впродовж 1-2 тижнів за регулярного виконання плану.</p>
                  </details>
                  <details>
                    <summary>Чи потрібно купувати специфічні продукти?</summary>
                    <p>Ні. База програми побудована на доступних продуктах і адаптується під ваш бюджет.</p>
                  </details>
                </div>
              </div>
            </section>
      
          </main>
      
          <footer className="footer">
            <div className="container">
              <p>CenterWay Herbs · 2026</p>
              <div className="footer-social-row" aria-label="Соціальні мережі CenterWay">
                <a
                  className="footer-social"
                  href="https://www.youtube.com/channel/UC0VPHLWTIXD3Rad5XkcyliA"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                >
                  <img className="footer-social-icon" src="../irem/img/youtube2.png" alt="YouTube" />
                </a>
                <a
                  className="footer-social"
                  href="https://t.me/E_Koriakin"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Telegram"
                >
                  <img className="footer-social-icon" src="../irem/img/telegram.png" alt="Telegram" />
                </a>
                <a
                  className="footer-social"
                  href="https://www.instagram.com/evgeniy_koryakin/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <img className="footer-social-icon" src="../irem/img/instagram.png" alt="Instagram" />
                </a>
                <a
                  className="footer-social"
                  href="https://www.facebook.com/people/%D0%95%D0%B2%D0%B3%D0%B5%D0%BD%D0%B8%D0%B9-%D0%9A%D0%BE%D1%80%D1%8F%D0%BA%D0%B8%D0%BD/pfbid0YaunkXwFi6MSSbgp7GjtxRMR7B3j6X9456AFwomQ7mLkracAdH9uCiKMxVYgkU8Ml/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  <img className="footer-social-icon" src="../irem/img/facebook.png" alt="Facebook" />
                </a>
              </div>
            </div>
          </footer>
      
          <div className="sticky-cta" id="sticky-cta" aria-hidden="true">
            <a
              className="btn btn-primary js-detox-cta"
              data-cta-place="sticky"
              href="https://t.me/E_Koriakin"
              target="_blank"
              rel="noopener noreferrer"
            >
              {ctaPrimaryLabel}
            </a>
          </div>
    </>
  );
}
