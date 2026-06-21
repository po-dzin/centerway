import type { Metadata } from "next";
import Script from "next/script";
import { resolveIremLandingOffer, type LandingResolvedOffer } from "@/lib/landing/offers";
import type { SearchParams } from "@/lib/products";
import styles from "./irem-v2.module.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ІВЕМ v2 | CenterWay",
  description:
    "Нова окрема версія лендинга ІВЕМ: щоденна система руху, дихання й уваги для стабільнішого ритму тіла та стану.",
  alternates: {
    canonical: "/irem-v2",
  },
  openGraph: {
    title: "ІВЕМ v2 | CenterWay",
    description:
      "Щоденна система руху, дихання й уваги без хаотичних перевантажень. Окремий funnel-variant для ІВЕМ.",
    url: "/irem-v2",
  },
  twitter: {
    card: "summary_large_image",
    title: "ІВЕМ v2 | CenterWay",
    description:
      "Щоденна система руху, дихання й уваги без хаотичних перевантажень. Окремий funnel-variant для ІВЕМ.",
  },
};

const fitItems = [
  {
    title: "Тіло втратило легкість",
    body: "З’являється відчуття скутості, втоми й нестачі внутрішньої опори навіть без явної хвороби чи травми.",
  },
  {
    title: "Ритм дня розсипається",
    body: "Енергія то піднімається, то різко падає, а сам стан сильно залежить від навантаження, стресу й недосипу.",
  },
  {
    title: "Спроби були, системи не було",
    body: "Окремі вправи, зарядки чи тренування не склались у маршрут, який реально можна втримати довше ніж кілька днів.",
  },
  {
    title: "Потрібен м’який, але серйозний формат",
    body: "Не спортивний тиск і не абстрактна теорія, а зрозуміла щоденна практика для тіла, дихання й внутрішнього стану.",
  },
];

const failureReasons = [
  "Немає єдиної логіки: сьогодні одне, завтра інше, і тіло не встигає адаптуватися.",
  "Навантаження або надто різке, або занадто хаотичне, тому практика швидко випадає з життя.",
  "Бракує переходу від активації до стабілізації, тож людина виходить не зібранішою, а ще більш напруженою.",
  "Формат не враховує реальний тижневий ритм, через що дисципліна тримається на зусиллі, а не на структурі.",
];

const methodPhases = [
  {
    title: "1. Активація",
    body: "Початок практики дає тілу імпульс: включення, тонус, м’який або інтенсивніший запуск залежно від дня циклу.",
  },
  {
    title: "2. Перерозподіл",
    body: "Друга частина збирає рух, дихання й увагу в послідовність від периферії до центру, щоб вирівнювати тонус і повертати тілу простір.",
  },
  {
    title: "3. Стабілізація",
    body: "Фінальний етап переводить практику від активності до інтеграції: баланс, розслаблення, м’який стречинг і увага до стану.",
  },
];

const weeklyRhythm = [
  {
    day: "Понеділок",
    title: "М’який вхід у тиждень",
    body: "Практика починає цикл з обережної активації, щоб включити тіло без різкого стресу.",
  },
  {
    day: "Вівторок",
    title: "Глибший силовий акцент",
    body: "Навантаження зміщується в бік більшої м’язової роботи та відчуття опори.",
  },
  {
    day: "Середа",
    title: "Розвантаження через динаміку",
    body: "З’являється більше швидкості, координації й рухового розряду без потреби в обтяженнях.",
  },
  {
    day: "Четвер",
    title: "Кругова цілісність",
    body: "Тіло працює як система: змінюються вектори, а практика збирає силу й витривалість без монотонності.",
  },
  {
    day: "П’ятниця",
    title: "Пружність і тонус",
    body: "Тиждень не зливається в втому: день підтримує живість, швидкісно-силовий відгук і відчуття енергії.",
  },
  {
    day: "Субота",
    title: "Пікове адаптаційне навантаження",
    body: "Найщільніший день циклу дає організму сигнал до глибшої адаптації й відновлення.",
  },
  {
    day: "Неділя",
    title: "Координація та інтеграція",
    body: "Цикл завершується зібраністю: складніші координаційні рухи допомагають закрити тиждень без перевантаження.",
  },
];

const sessionPrinciples = [
  {
    title: "Рух від периферії до центру",
    body: "У щоденній базовій частині система проходить шлях від кистей і стоп до центральної осі тіла.",
  },
  {
    title: "Дихання як частина структури",
    body: "Дихання не винесене окремо: воно вшите в ритм практики й допомагає переводити тіло з напруги в зібраність.",
  },
  {
    title: "Увага як інтегруючий шар",
    body: "ІВЕМ працює не тільки через механіку руху, а й через спосіб утримувати увагу всередині дії.",
  },
];

const expectedChanges = [
  {
    title: "Більше рухливості й відчуття простору в тілі",
    body: "За умови регулярної практики багато учасників відзначають, що тіло стає менш скутою й легше входить у рух.",
  },
  {
    title: "Стабільніший рівень енергії",
    body: "Практика спрямована на те, щоб день тримався рівніше: без різких піків, провалів і відчуття внутрішнього розсипання.",
  },
  {
    title: "Спокійніший внутрішній контур",
    body: "Коли сесія закінчується не на збудженні, а на стабілізації, стан часто стає зібранішим і спокійнішим.",
  },
  {
    title: "Ритм, який простіше втримати",
    body: "Головна цінність ІВЕМ не в разовому ефекті, а в тому, що структура допомагає втримувати практику в реальному тижні.",
  },
];

const faqItems = [
  {
    question: "Чи підійде ІВЕМ, якщо я зараз не у формі?",
    answer:
      "Так. Формат розрахований на різний стартовий стан: навантаження можна адаптувати, а ритм — набирати поступово.",
  },
  {
    question: "Це більше про тіло чи про внутрішній стан?",
    answer:
      "ІВЕМ поєднує обидва шари. Система працює через рух, дихання й увагу, тому не зводиться тільки до фізичної вправи.",
  },
  {
    question: "Скільки часу потрібно, щоб практика дала відчутний сенс?",
    answer:
      "Перші зміни люди часто помічають уже в самому ритмі тижня: як тіло входить у день, як тримається енергія, як легше зібратись після навантаження.",
  },
  {
    question: "Це медичне лікування або діагностика?",
    answer:
      "Ні. ІВЕМ не є медичною діагностикою чи лікуванням. Це практика, спрямована на системну щоденну роботу з тілом і станом.",
  },
  {
    question: "Що робити, якщо я ще не готовий(а) до повного формату?",
    answer:
      "У нижньому support-блоці є Short як м’який вхід у підхід CenterWay без конкуренції з основним маршрутом ІВЕМ.",
  },
];

const heroHighlights = [
  { value: "7 практик", label: "на тиждень" },
  { value: "60 хвилин", label: "у власному ритмі" },
  { value: "Підходить", label: "для різного рівня" },
  { value: "Доступ", label: "з телефону, ПК, планшета" },
];

function renderPrice(offer: LandingResolvedOffer, place: "hero" | "final") {
  const activePromo = offer.offerApplied && !offer.offerExpired;

  return (
    <div className={styles.pricePanel}>
      <div className={`price-stack ${styles.priceStack}`}>
        {offer.oldPriceLabel ? <span className="price-old">{offer.oldPriceLabel}</span> : null}
        <span className="price-current">{offer.currentPriceLabel}</span>
        {activePromo && offer.discountPercent ? (
          <span className={styles.discountBadge}>-{offer.discountPercent}%</span>
        ) : null}
      </div>
      {activePromo && offer.expiresAt ? (
        <p className={styles.promoNote}>
          <span data-promo-note-label>{offer.activeNote ?? "Персональна ціна для раннього входу діє ще"}</span>
          <span className={styles.promoTimer} data-promo-timer aria-live="polite">
            48:00:00
          </span>
        </p>
      ) : offer.expiredNote ? (
        <p className={styles.promoNote}>{offer.expiredNote}</p>
      ) : null}
      <button className={`openModal ${styles.primaryCta}`} data-cta-place={place} {...(place === "hero" ? { "data-cta-primary": true } : { "data-cta-final": true })}>
        Приєднатися до ІВЕМ
      </button>
    </div>
  );
}

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function IremV2Page({ searchParams }: PageProps) {
  const offer = await resolveIremLandingOffer(await searchParams);

  return (
    <>
      <Script src="/shared/js/landing-pixel.js" data-cw-product="irem" strategy="afterInteractive" />
      <Script src="/irem/js/lazysizes.min.js" strategy="afterInteractive" async />
      <Script src="/irem/js/common.js" strategy="afterInteractive" async />
      <Script src="/shared/js/landing-runtime.js" strategy="afterInteractive" />

      <main
        className={styles.page}
        data-cw-landing="irem"
        data-cw-runtime="next"
        data-cw-page="irem-v2"
        data-cw-offer-id={offer.offerId}
        data-cw-price-value={offer.amount}
        data-cw-currency={offer.currency}
        data-cw-offer-token={offer.offerApplied ? offer.offerToken ?? undefined : undefined}
        data-cw-offer-state={offer.offerApplied ? "active" : offer.offerExpired ? "expired" : "base"}
        data-cw-offer-issued-at={offer.issuedAt ?? undefined}
        data-cw-offer-expires-at={offer.expiresAt ?? undefined}
      >
        <section className={styles.hero} data-section="hero-v2">
          <div className={styles.container}>
            <div className={styles.heroShell}>
              <div className={styles.heroTopbar}>
                <div className={styles.heroBrand}>
                  <span className={styles.heroBrandMark} aria-hidden="true" />
                  <span className={styles.heroBrandText}>CenterWay</span>
                </div>
              </div>

              <div className={styles.heroGrid}>
                <div className={styles.heroContent}>
                  <span className={styles.heroBadge}>Авторська система ІВЕМ</span>
                  <h1 className={styles.heroTitle}>ІВЕМ — система щоденної практики руху, дихання й уваги</h1>
                  <p className={styles.heroLead}>
                    Поверніть стабільну енергію, легкість у тілі та внутрішній баланс через зрозумілий тижневий
                    маршрут, який реально втримати у власному ритмі.
                  </p>
                  <div className={styles.heroChips} aria-label="Ключові сигнали формату">
                    {heroHighlights.map((item) => (
                      <article key={item.value} className={styles.heroChipCard}>
                        <strong>{item.value}</strong>
                        <span>{item.label}</span>
                      </article>
                    ))}
                  </div>
                  <div className={styles.heroOfferBlock}>
                    {renderPrice(offer, "hero")}
                    <p className={styles.heroNote}>
                      Практика побудована як один маршрут: активація → перерозподіл → стабілізація.
                    </p>
                  </div>
                </div>

                <div className={styles.heroVisual}>
                  <img
                    src="/irem/img/L4.webp"
                    alt="ІВЕМ-практика CenterWay"
                    width="1020"
                    height="1020"
                    className={styles.heroImage}
                  />
                  <div className={styles.heroVisualCard}>
                    <p className={styles.heroVisualTitle}>Для кого ця версія маршруту</p>
                    <p className={styles.heroVisualCopy}>
                      Для людей, яким потрібна не випадкова активність, а щоденна система для енергії, рухливості й
                      внутрішньої зібраності.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div data-sticky-menu>
          <button className="openModal">Приєднатися до ІВЕМ</button>
        </div>

        <section className={styles.section} data-section="fit">
          <div className={styles.container}>
            <div className={`${styles.sectionShell} ${styles.sectionShellCalm}`}>
              <div className={styles.sectionHeaderGrid}>
                <div className={styles.sectionRail}>
                  <p className={styles.kicker}>Коли ІВЕМ стає доречною</p>
                  <span className={styles.sectionMarker}>01</span>
                </div>
                <div className={styles.sectionHeading}>
                  <h2>Не коли “пора взятись за себе”, а коли потрібен ритм, який не розвалиться за тиждень</h2>
                  <p>
                    Нова версія сторінки CenterWay для ІВЕМ починає не з терміна, а з реальної ситуації людини: тіло,
                    енергія й внутрішній стан виходять із синхрону, а надійної практики немає.
                  </p>
                </div>
              </div>
              <div className={styles.cardGrid}>
                {fitItems.map((item) => (
                  <article key={item.title} className={styles.infoCard}>
                    <span className={styles.cardAccent} aria-hidden="true" />
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.sectionAlt} data-section="problem-reframe">
          <div className={styles.container}>
            <div className={`${styles.sectionShell} ${styles.sectionShellWarm}`}>
              <div className={styles.sectionHeaderGrid}>
                <div className={styles.sectionRail}>
                  <p className={styles.kicker}>Чому звичні спроби не складаються</p>
                  <span className={styles.sectionMarker}>02</span>
                </div>
                <div className={styles.sectionHeading}>
                  <h2>Проблема рідко в тому, що ви нічого не робите. Частіше проблема в тому, що немає системи.</h2>
                </div>
              </div>
              <div className={styles.listCard}>
                <p className={styles.listIntro}>
                  ІВЕМ вирішує не проблему “ще однієї практики”, а проблему відсутності маршруту, який тіло й увага
                  можуть витримати в реальному тижні.
                </p>
                <ul className={styles.reasonList}>
                  {failureReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} data-section="method">
          <div className={styles.container}>
            <div className={`${styles.sectionShell} ${styles.sectionShellGuide}`}>
              <div className={styles.sectionHeaderGrid}>
                <div className={styles.sectionRail}>
                  <p className={styles.kicker}>Фундамент із аналізу ІВЕМ</p>
                  <span className={styles.sectionMarker}>03</span>
                </div>
                <div className={styles.sectionHeading}>
                  <h2>Система тримається на трьох фазах: збудження, перерозподіл, інтеграція</h2>
                  <p>
                    Саме ця логіка з `.docx` є ядром нової версії: не “магія методу”, а чітка архітектура щоденної
                    практики.
                  </p>
                </div>
              </div>
              <div className={styles.phaseGrid}>
                {methodPhases.map((phase) => (
                  <article key={phase.title} className={styles.phaseCard}>
                    <span className={styles.phaseNumber}>{phase.title.split(".")[0]}</span>
                    <h3>{phase.title}</h3>
                    <p>{phase.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.sectionAlt} data-section="weekly-rhythm">
          <div className={styles.container}>
            <div className={`${styles.sectionShell} ${styles.sectionShellRhythm}`}>
              <div className={styles.sectionHeaderGrid}>
                <div className={styles.sectionRail}>
                  <p className={styles.kicker}>Тижневий ритм</p>
                  <span className={styles.sectionMarker}>04</span>
                </div>
                <div className={styles.sectionHeading}>
                  <h2>Кожен день має свій акцент, але маршрут залишається єдиним</h2>
                  <p>
                    Документ сильний тим, що показує ІВЕМ не як однакове щоденне коло, а як узгоджений тижневий цикл.
                    Нижче — адаптована версія цієї логіки без агресивних claims.
                  </p>
                </div>
              </div>
              <div className={styles.weekGrid}>
                {weeklyRhythm.map((item) => (
                  <article key={item.day} className={styles.dayCard}>
                    <p className={styles.dayName}>{item.day}</p>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
              <p className={styles.weekFootnote}>
                Кожна практика триває близько 60 хвилин у власному ритмі. Пропускаєте день? Повертаєтесь у наступному.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section} data-section="session-principles">
          <div className={styles.container}>
            <div className={`${styles.sectionShell} ${styles.sectionShellCalm}`}>
              <div className={styles.sectionHeaderGrid}>
                <div className={styles.sectionRail}>
                  <p className={styles.kicker}>Що відбувається в кожній практиці</p>
                  <span className={styles.sectionMarker}>05</span>
                </div>
                <div className={styles.sectionHeading}>
                  <h2>Рух, дихання й увага не роз’єднані — вони працюють як один маршрут</h2>
                </div>
              </div>
              <div className={styles.cardGrid}>
                {sessionPrinciples.map((item) => (
                  <article key={item.title} className={styles.infoCard}>
                    <span className={styles.cardAccent} aria-hidden="true" />
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.sectionAlt} data-section="results">
          <div className={styles.container}>
            <div className={`${styles.sectionShell} ${styles.sectionShellWarm}`}>
              <div className={styles.sectionHeaderGrid}>
                <div className={styles.sectionRail}>
                  <p className={styles.kicker}>Що можна очікувати</p>
                  <span className={styles.sectionMarker}>06</span>
                </div>
                <div className={styles.sectionHeading}>
                  <h2>Не гучні обіцянки, а зміни, які практика допомагає накопичувати від тижня до тижня</h2>
                </div>
              </div>
              <div className="accordion">
                {expectedChanges.map((item, index) => (
                  <section key={item.title} className="accordion_item">
                    <h3 className="title_block">
                      <span className={styles.accordionNumber}>{String(index + 1).padStart(2, "0")}</span>
                      {item.title}
                    </h3>
                    <div className="info">
                      <p>{item.body}</p>
                    </div>
                  </section>
                ))}
              </div>
              <div className={styles.boundaryNote}>
                <p>
                  ІВЕМ не є медичною діагностикою чи лікуванням. Якщо у вас є гострий стан, травма або обмеження,
                  навантаження варто адаптувати під себе й за потреби проконсультуватися зі спеціалістом.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.proofSection}`} data-section="proof">
          <div className={styles.container}>
            <div className={styles.proofShell}>
              <div className={styles.proofGrid}>
                <div className={styles.expertCard}>
                  <p className={styles.kicker}>Проводник і trust-surface</p>
                  <h2>ІВЕМ у CenterWay подається як маршрут, а не як спектакль навколо методу</h2>
                  <p>
                    У новій версії сторінки важливо не “зачарувати” людину, а показати, хто веде практику і чому цій
                    структурі можна довіряти.
                  </p>
                  <blockquote className={styles.quote}>
                    «Цей метод розроблений та практикується моїм вчителем протягом 44 років»
                  </blockquote>
                  <ul className={styles.proofList}>
                    <li>ІВЕМ подається як щоденна система з ясним наступним кроком, а не як набір випадкових вправ.</li>
                    <li>Практика тримає баланс між тілесною роботою, диханням і внутрішнім контуром уваги.</li>
                    <li>CenterWay зберігає дорослий тон: без туману, без псевдомедицини, без гучних обіцянок.</li>
                  </ul>
                  <img
                    src="/irem/img/L%203.webp"
                    alt="Куратор ІВЕМ у CenterWay"
                    width="1020"
                    height="1020"
                    className={styles.expertImage}
                  />
                </div>

                <div className={styles.reviewsCard}>
                  <p className={styles.kicker}>Досвід учасників</p>
                  <h2>Соціальне підтвердження краще працює поруч із методом, а не замість методу</h2>
                  <p className={styles.reviewsLead}>
                    Відгуки тут працюють як підтвердження прожитого досвіду, але не забирають на себе роль головного
                    аргументу.
                  </p>
                  <div className={`reviews-carousel ${styles.reviewsCarousel}`}>
                    <button className={`carousel-btn prev ${styles.carouselButton}`} type="button" aria-label="Попередній відгук">
                      <span aria-hidden="true">‹</span>
                    </button>
                    <div className={`reviews-track ${styles.reviewsTrack}`}>
                      {Array.from({ length: 8 }, (_, index) => (
                        <div key={index} className={styles.reviewsItem}>
                          <img
                            src={`/irem/img/Screenshot_${index + 1}.webp`}
                            alt={`Відгук ${index + 1}`}
                            width="768"
                            height="960"
                          />
                        </div>
                      ))}
                    </div>
                    <button className={`carousel-btn next ${styles.carouselButton}`} type="button" aria-label="Наступний відгук">
                      <span aria-hidden="true">›</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.sectionAlt} ${styles.formatsSection}`} data-section="formats">
          <div className={styles.container}>
            <div className={styles.formatsShell}>
              <div className={`${styles.sectionHeading} ${styles.sectionHeadingWide}`}>
                <p className={styles.kicker}>Формати участі</p>
                <h2>Один головний маршрут і один premium-рівень супроводу</h2>
                <p>
                  Основний вибір лишається простим: або ви заходите в ІВЕМ як у щоденну систему, або обираєте
                  індивідуальний формат з прямим супроводом.
                </p>
              </div>
              <div className={styles.formatGrid}>
                <article className={styles.formatCardPrimary}>
                  <p className={styles.formatEyebrow}>Рекомендовано</p>
                  <h3>ІВЕМ Online</h3>
                  <p className={styles.formatPrice}>4100 грн</p>
                  <p className={styles.formatLead}>Для тих, хто хоче самостійно зайти в системну щоденну практику.</p>
                  <ul className={styles.formatList}>
                    <li>7 відеоуроків на тиждень</li>
                    <li>Текстові пояснення до вправ</li>
                    <li>Адаптація навантаження під свій стан</li>
                    <li>Доступ з телефону, ПК та планшета</li>
                  </ul>
                  <button className={`openModal ${styles.primaryCta}`} data-cta-place="formats-main">
                    Приєднатися до ІВЕМ
                  </button>
                </article>

                <article className={styles.formatCard}>
                  <p className={styles.formatEyebrow}>Персональний супровід</p>
                  <h3>Індивідуальна програма</h3>
                  <p className={styles.formatPrice}>35 000 грн / місяць</p>
                  <p className={styles.formatLead}>Для тих, кому потрібен найщільніший маршрут з автором.</p>
                  <ul className={styles.formatList}>
                    <li>Персональний маршрут під ваш запит</li>
                    <li>Індивідуальні корекції та зворотний зв’язок</li>
                    <li>Прямий контакт у Telegram</li>
                    <li>Щільніший супровід у процесі практики</li>
                  </ul>
                  <a
                    className={styles.telegramLink}
                    href="https://t.me/E_Koriakin"
                    data-cta-premium-contact
                    data-cta-place="formats-premium"
                  >
                    Написати в Telegram
                  </a>
                </article>
              </div>
              <p className={styles.formatsSupport}>
                Якщо вам потрібен регулярний самостійний ритм, основний вибір тут один: ІВЕМ. Персональний формат
                лишається окремим маршрутом для тих, кому потрібен прямий супровід.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section} data-section="faq">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Питання й заперечення</p>
              <h2>У цій версії сторінки objection-handling винесений у нормальну, дорослу площину</h2>
            </div>
            <div className="accordion">
              {faqItems.map((item, index) => (
                <section key={item.question} className="accordion_item">
                  <h3 className="title_block">
                    <span className={styles.accordionNumber}>{String(index + 1).padStart(2, "0")}</span>
                    {item.question}
                  </h3>
                  <div className="info">
                    <p>{item.answer}</p>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.finalOffer} ${styles.finalOfferSection}`} data-section="final-offer-v2">
          <div className={styles.container}>
            <div className={styles.finalShell}>
              <div className={styles.finalCard}>
                <div className={styles.finalCardContent}>
                  <p className={styles.kicker}>Головний наступний крок</p>
                  <h2>Якщо вам потрібна практика, яку можна реально тримати в житті, почніть з ІВЕМ</h2>
                  <p className={styles.finalLead}>
                    Якщо в перші 14 днів ви регулярно займаєтесь і бачите, що формат вам не підходить, напишіть нам —
                    розглянемо повернення коштів.
                  </p>
                </div>
                <div className={styles.finalCardAction}>{renderPrice(offer, "final")}</div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.shortEntry} ${styles.shortEntrySection}`} data-section="short-support-v2">
          <div className={styles.container}>
            <div className={styles.shortShell}>
              <div className={styles.shortCard}>
                <p className={styles.shortEyebrow}>М’який вхід для тих, хто ще вагається</p>
                <h2>Ще не готові до повного ІВЕМ?</h2>
                <p className={styles.shortCopy}>
                  Якщо хочете спочатку м’яко познайомитися з підходом CenterWay, почніть з короткого формату без
                  великого порогу рішення.
                </p>
                <div className={styles.shortOffer}>
                  <div>
                    <h3>Short-Перезавантаження</h3>
                    <p className={styles.shortPrice}>359 грн</p>
                  </div>
                  <p>
                    Короткий вхід у підхід: швидко спробувати ритм, рух і базову практику перед глибшим маршрутом.
                  </p>
                </div>
                <a
                  className={styles.shortLink}
                  href="https://reboot.centerway.net.ua/"
                  data-cta-short-entry
                  data-cta-place="short-fallback-v2"
                >
                  Почати з Short
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
