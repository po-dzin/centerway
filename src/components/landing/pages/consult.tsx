"use client";

/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
import { useLandingRuntime } from "@/components/landing/runtime/useLandingRuntime";
import type { GeneratorAnalyticsContext } from "@/lib/generator/renderContext";

type ConsultLandingPageProps = {
  ctaPrimaryLabel?: string;
  generatorContext?: GeneratorAnalyticsContext;
};

export function ConsultLandingPage({ ctaPrimaryLabel = "Записатися", generatorContext }: ConsultLandingPageProps) {
  useLandingRuntime({
    product: "consult",
    contentName: "CenterWay Consultation",
    ctaClass: "js-consult-cta",
    ctaEventName: "ConsultCTA",
    generatorContext,
  });

  return (
    <>
      <div className="bg-noise variant-default-node" aria-hidden="true"></div>
          <div className="cw-bg-atmosphere variant-default-node" aria-hidden="true"></div>
      
          <header className="hero section variant-default-node" id="top">
            <div className="container reveal">
              <div className="hero-headline">
                <span className="eyebrow">CENTERWAY CONSULTATION</span>
                <h1>Аюрведична консультація як <span className="accent">структурований маршрут</span> відновлення</h1>
                <p className="lead">
                  Без тиску та магічних обіцянок. Ви отримуєте персональний аюрведичний профіль,
                  практичні кроки в харчуванні та режимі, і план дій на найближчі 2-4 тижні.
                </p>
              </div>
      
              <div className="hero-card role-proof-card">
                <h2>Що важливо знати одразу</h2>
                <ul className="bullet-list">
                  <li>Формат: онлайн, до 90 хвилин.</li>
                  <li>Результат: персональна шпаргалка + чекліст впровадження на 2-4 тижні.</li>
                  <li>Підхід: аюрведа як практична система, адаптована під ваш ритм життя.</li>
                </ul>
                <a
                  className="btn btn-primary js-consult-cta"
                  data-cta-place="hero"
                  href="https://t.me/E_Koriakin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ctaPrimaryLabel}
                </a>
                <a
                  className="btn btn-ghost js-consult-cta"
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
      
          <main className="variant-default-node">
            <section className="section">
              <div className="container reveal">
                <h2>Кому підходить консультація</h2>
                <div className="grid grid-3">
                  <article className="role-support-card card">
                    <span className="card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 7.7A4 4 0 0 1 12 4a4 4 0 0 1 4 4v1.5c0 1.6-.7 3.2-2 4.2L12 15.5V18"></path>
                        <path d="M9 20h6"></path>
                        <path d="M6.2 8.4h1.3"></path>
                        <path d="M5.6 10.4h1.3"></path>
                        <path d="M17.5 8.4h1.3"></path>
                      </svg>
                    </span>
                    <h3>Ментальне навантаження</h3>
                    <p>Для тих, хто працює в інтенсивному ритмі та хоче повернути стабільний ресурс.</p>
                  </article>
                  <article className="role-support-card card">
                    <span className="card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="6.2" r="1.7"></circle>
                        <path d="M12 8.5v4.2"></path>
                        <path d="M8.3 12.8 12 10.9l3.7 1.9"></path>
                        <path d="M6.8 16.8c1.2-1.2 2.6-1.8 5.2-1.8s4 .6 5.2 1.8"></path>
                        <path d="M9.1 18.6 12 16.9l2.9 1.7"></path>
                      </svg>
                    </span>
                    <h3>Тілесна практика</h3>
                    <p>Для практиків йоги/фітнесу/цигуну, яким потрібна персональна синхронізація режиму.</p>
                  </article>
                  <article className="role-support-card card">
                    <span className="card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.8 10.3 12 5l7.2 5.3V19a1 1 0 0 1-1 1H5.8a1 1 0 0 1-1-1z"></path>
                        <path d="M9.2 14.1 11.3 16l3.7-3.7"></path>
                      </svg>
                    </span>
                    <h3>Побутова реалізація</h3>
                    <p>Для тих, хто хоче практичні зміни, сумісні з сім'єю, роботою та відрядженнями.</p>
                  </article>
                </div>
              </div>
            </section>
      
            <section className="section section-muted">
              <div className="container reveal">
                <h2>Типові запити</h2>
                <div className="grid grid-2">
                  <ul className="bullet-list role-practice-card card">
                    <li>Нестабільна енергія протягом дня.</li>
                    <li>Дискомфорт після їжі, тяжкість, здуття.</li>
                    <li>Складно тримати ритм сну та відновлення.</li>
                  </ul>
                  <ul className="bullet-list role-practice-card card">
                    <li>Стрес і висока реактивність нервової системи.</li>
                    <li>Відчуття, що система харчування не працює саме для вас.</li>
                    <li>Потрібен персональний план без крайнощів і заборон «назавжди».</li>
                  </ul>
                </div>
              </div>
            </section>
      
            <section className="section">
              <div className="container reveal">
                <h2>Що ви отримаєте</h2>
                <div className="grid grid-2">
                  <article className="role-path-card card">
                    <h3>Персональний профіль</h3>
                    <p>
                      Аюрведичний профіль (конституція/доша), аналіз поточних звичок та пріоритетів на старті.
                    </p>
                  </article>
                  <article className="role-path-card card">
                    <h3>План харчування і режиму</h3>
                    <p>
                      Що змінити в раціоні, ритмі дня, відновленні та навантаженнях у найближчому циклі.
                    </p>
                  </article>
                  <article className="role-path-card card">
                    <h3>SOS-алгоритми</h3>
                    <p>
                      Що робити в дні перевантаження: короткі дії для сну, енергії та комфортного травлення.
                    </p>
                  </article>
                  <article className="role-path-card card">
                    <h3>Чекліст на 2-4 тижні</h3>
                    <p>
                      Конкретна шпаргалка впровадження з пріоритетами, щоб бачити прогрес без когнітивного перевантаження.
                    </p>
                  </article>
                </div>
              </div>
            </section>
      
            <section className="section section-muted">
              <div className="container reveal">
                <h2>Як проходить консультація</h2>
                <ol className="timeline role-method-card">
                  <li>
                    <span className="step-index">1</span>
                    <div>
                      <h3>Стартовий скринінг (5-10 хв)</h3>
                      <p>Коротка анкета, запит, цілі, поточний стан та обмеження.</p>
                    </div>
                  </li>
                  <li>
                    <span className="step-index">2</span>
                    <div>
                      <h3>Основна сесія (до 60 хв)</h3>
                      <p>Розбір харчування, ритму, стрес-тригерів та тілесних патернів.</p>
                    </div>
                  </li>
                  <li>
                    <span className="step-index">3</span>
                    <div>
                      <h3>План дій (20-25 хв)</h3>
                      <p>Пріоритети на перший цикл, правила адаптації, відповіді на запитання.</p>
                    </div>
                  </li>
                </ol>
              </div>
            </section>
      
            <section className="section">
              <div className="container reveal">
                <h2>Хто консультує</h2>
                <article className="bio-card role-proof-card">
                  <h3>Євгеній Корякін (CenterWay)</h3>
                  <p>
                    Практик аюрведи та тілесних систем. Фокус консультації: інтегрувати принципи аюрведи
                    в сучасний ритм життя без фанатизму та без маніпулятивних обіцянок.
                  </p>
                </article>
              </div>
            </section>
      
            <section className="section section-pricing" id="price">
              <div className="container reveal">
                <h2>Формат і вартість</h2>
                <div className="pricing-card role-pricing-card" data-price-value="2400">
                  <div className="pricing-main">
                    <p className="pricing-label">Базова консультація</p>
                    <p className="pricing-value"><span className="js-price-value">2 400</span> грн</p>
                  </div>
                  <ul className="bullet-list">
                    <li>Тривалість: до 90 хвилин.</li>
                    <li>Формат: онлайн.</li>
                    <li>Матеріали: персональна шпаргалка та чекліст на 2-4 тижні.</li>
                  </ul>
                  <a
                    className="btn btn-primary js-consult-cta"
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
                    Консультація є освітньо-практичним супроводом і не замінює медичну допомогу.
                    Якщо є медичні ризики, рекомендовано звернутися до профільного лікаря.
                  </p>
                  <p>
                    Ми не даємо гарантій лікування чи універсального результату.
                    Рекомендації формуються від ваших реалій: графік, бюджет, доступні продукти
                    та поточний рівень навантаження.
                  </p>
                </div>
              </div>
            </section>
      
            <section className="section">
              <div className="container reveal">
                <h2>FAQ</h2>
                <div className="faq-list">
                  <details>
                    <summary>Чи підійде консультація, якщо я лише починаю?</summary>
                    <p>Так. План будується від стартового рівня і не вимагає попередньої підготовки.</p>
                  </details>
                  <details>
                    <summary>Коли очікувати перші зміни?</summary>
                    <p>
                      Зазвичай перші сигнали в самопочутті видно протягом перших 1-2 тижнів при регулярному виконанні плану.
                    </p>
                  </details>
                  <details>
                    <summary>Чи є супровід після консультації?</summary>
                    <p>
                      У Telegram можна поставити уточнюючі питання щодо впровадження базових рекомендацій першого циклу.
                    </p>
                  </details>
                </div>
              </div>
            </section>
      
          </main>
      
          <footer className="footer variant-default-node">
            <div className="container">
              <p>CenterWay · 2026</p>
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
      
          <div className="sticky-cta variant-default-node" id="sticky-cta" aria-hidden="true">
            <a
              className="btn btn-primary js-consult-cta"
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
