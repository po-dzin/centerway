"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "@/components/platform/PlatformContentStyles";
import { usePlatformHref } from "@/components/platform/layout/usePlatformHref";

type ProfileResponse = {
  userId: string;
  profile: {
    account: {
      email: string | null;
      fullName: string | null;
      avatarUrl: string | null;
    };
    contacts: {
      phone: string | null;
      telegram: string | null;
    } | null;
    dosha: {
      attemptId: string;
      testId: string;
      testSlug: string;
      resultType: string;
      version: number | null;
      completedAt: string | null;
      scores: {
        vata: number | null;
        pitta: number | null;
        kapha: number | null;
      };
    } | null;
    purchases: Array<{
      orderRef: string;
      offerCode: string;
      offerKind: string;
      title: string;
      amount: number | null;
      currency: string | null;
      createdAt: string | null;
      access: {
        order_ref: string;
        used: boolean;
        expires_at: string | null;
        created_at: string | null;
      } | null;
    }>;
    progress: {
      items: unknown[];
      note: string;
    };
  };
};

type ProfileLang = "uk" | "en";

const LANG_EVENT = "cw-lang-change";

function resolveProfileLang(): ProfileLang {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("lang");
      if (stored === "en") return "en";
    } catch {
      // ignore storage read errors
    }
  }

  if (typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("en")) {
    return "en";
  }

  return "uk";
}

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function fmtShortDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number") return "—";
  return `${amount} ${currency ?? ""}`.trim();
}

function getUserInitial(session: Session | null, fullName: string | null | undefined) {
  const source =
    fullName ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email ||
    "";
  return source.trim().charAt(0).toUpperCase() || "?";
}

function isProgramKind(kind: string) {
  return kind === "program" || kind === "mini-course";
}

function isAccessActive(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

function formatDoshaResult(resultType: string | null | undefined, lang: ProfileLang) {
  const raw = (resultType ?? "").trim().toLowerCase();
  if (!raw) {
    return lang === "en" ? "Not defined yet" : "Ще не визначено";
  }

  const dictionary = lang === "en"
    ? {
        vata: "Vata",
        pitta: "Pitta",
        kapha: "Kapha",
        tridosha: "Tridosha",
        tridoshic: "Tridoshic",
      }
    : {
        vata: "Вата",
        pitta: "Пітта",
        kapha: "Капха",
        tridosha: "Тридоша",
        tridoshic: "Тридоша",
      };

  return raw.replace(/\b(vata|pitta|kapha|tridosha|tridoshic)\b/g, (token) => dictionary[token as keyof typeof dictionary] ?? token);
}

function formatAccessStatus(used: boolean, expiresAt: string | null | undefined, lang: ProfileLang) {
  if (used) return lang === "en" ? "Access used" : "Доступ використано";
  if (!expiresAt) return lang === "en" ? "Access created" : "Доступ створено";

  const expiry = new Date(expiresAt).getTime();
  if (Number.isFinite(expiry) && Date.now() > expiry) {
    return lang === "en" ? "Access expired" : "Термін доступу минув";
  }

  return lang === "en" ? "Access active" : "Доступ активний";
}

export function UserProfilePageClient() {
  const [session, setSession] = useState<Session | null>(null);
  const isAuthEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [loading, setLoading] = useState(isAuthEnabled);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<ProfileLang>("uk");
  const doshaTestHref = usePlatformHref("/dosha-test");
  const homeHref = usePlatformHref("/");

  useEffect(() => {
    const syncLang = () => setLang(resolveProfileLang());
    syncLang();
    window.addEventListener("storage", syncLang);
    window.addEventListener(LANG_EVENT, syncLang);
    return () => {
      window.removeEventListener("storage", syncLang);
      window.removeEventListener(LANG_EVENT, syncLang);
    };
  }, []);

  const activePrograms = useMemo(
    () =>
      (profile?.profile.purchases ?? []).filter(
        (purchase) => isProgramKind(purchase.offerKind) && purchase.access && !purchase.access.used && isAccessActive(purchase.access.expires_at),
      ),
    [profile],
  );

  const completedPrograms = useMemo(
    () =>
      (profile?.profile.purchases ?? []).filter(
        (purchase) => isProgramKind(purchase.offerKind) && (purchase.access?.used || !purchase.access || !isAccessActive(purchase.access.expires_at)),
      ),
    [profile],
  );

  const productPurchases = useMemo(
    () => (profile?.profile.purchases ?? []).filter((purchase) => purchase.offerKind === "product"),
    [profile],
  );

  const copy = useMemo(
    () =>
      lang === "en"
        ? {
            profile: "Profile",
            loadingTitle: "Loading your data",
            loadingLead: "We are gathering your dosha result, programs, products, and contact fields.",
            authTitle: "Sign in to view your route",
            authLead: "Your dosha result, programs, products, and contact details will appear here.",
            signIn: "Sign in with Google",
            returnHome: "Return home",
            takeDosha: "Take the dosha test",
            badge: "Profile · Dosha · Route",
            dosha: "Dosha",
            activePrograms: "Active programs",
            products: "Products",
            contacts: "Contacts",
            contactsReady: "Saved",
            contactsMissing: "Add your details",
            noDosha: "Not defined yet",
            noPrograms: "None yet",
            hasPrograms: "In progress",
            hasProducts: "Added to profile",
            noProducts: "None yet",
            heroViewDosha: "View dosha result",
            signOut: "Sign out",
            doshaCurrent: "Current result",
            doshaResultPrefix: "Result",
            doshaCompletedPrefix: "Completed",
            completedShort: "Completed",
            retakeTest: "Retake the test",
            doshaEmptyLead: "There is no completed dosha test in this profile yet, so the personal state map is not assembled.",
            startTest: "Start the dosha test",
            routeSummaryLabel: "Route",
            routeSummaryTitle: "Current route summary",
            summaryActivePrograms: "Active programs",
            summaryCompletedPrograms: "Completed programs",
            summaryProducts: "Products in profile",
            summaryActiveProgramsValue: activePrograms.length > 0 ? `${activePrograms.length}` : "None yet",
            summaryCompletedProgramsValue: completedPrograms.length > 0 ? `${completedPrograms.length}` : "None yet",
            summaryProductsValue: productPurchases.length > 0 ? `${productPurchases.length}` : "None yet",
            programsLabel: "Programs",
            programsTitle: "Active and completed routes",
            activeProgramLabel: "Active program",
            completedProgramLabel: "Completed route",
            routeStarted: "Route started",
            purchasedAt: "Purchase date",
            accessStatus: "Access status",
            programProgressNote: "Detailed lesson progress will appear here once the platform starts storing program completion.",
            programAccessManual: "Access is activated manually",
            programAccessNoToken: "This route was issued without a separate access token",
            noProgramsLead: "There are no programs linked to this profile yet.",
            productsTitle: "Purchased support formats",
            productLabel: "Product",
            price: "Price",
            productNoAccess: "Not created yet",
            noProductsLead: "There are no purchased products linked to this profile yet.",
            progressLabel: "Progress",
            progressTitle: "Program progress",
            progressLead: "Program progress will appear here once the platform starts storing lesson and program completion.",
            contactsTitle: "Saved contact fields",
            name: "Name",
            email: "Email",
            phone: "Phone",
            telegram: "Telegram",
            unavailableTitle: "Profile is temporarily unavailable",
            unavailableLead: "Google auth is disabled in this build, so the personal profile is not available here yet.",
            errorTitle: "Could not assemble the profile",
            errorFallback: "Please refresh the page a bit later.",
            emptyValue: "—",
            doshaLabels: { vata: "Vata", pitta: "Pitta", kapha: "Kapha" },
          }
        : {
            profile: "Профіль",
            loadingTitle: "Завантажуємо ваші дані",
            loadingLead: "Підтягуємо результат доша-тесту, програми, продукти і ваші контактні поля.",
            authTitle: "Увійдіть, щоб побачити свій маршрут",
            authLead: "Тут буде ваш результат доша-тесту, програми, продукти і контактна інформація.",
            signIn: "Увійти через Google",
            returnHome: "Повернутися на головну",
            takeDosha: "Пройти доша-тест",
            badge: "Профіль · Доша · Маршрут",
            dosha: "Доша",
            activePrograms: "Активні програми",
            products: "Продукти",
            contacts: "Контакти",
            contactsReady: "Заповнені",
            contactsMissing: "Додайте дані",
            noDosha: "Ще не визначено",
            noPrograms: "Поки немає",
            hasPrograms: "Є маршрут",
            hasProducts: "Додані до профілю",
            noProducts: "Поки немає",
            heroViewDosha: "Подивитися результат доші",
            signOut: "Вийти",
            doshaCurrent: "Поточний результат",
            doshaResultPrefix: "Результат",
            doshaCompletedPrefix: "Завершено",
            completedShort: "Пройдено",
            retakeTest: "Перепройти тест",
            doshaEmptyLead: "У профілі ще немає завершеного доша-тесту, тому персональна карта стану поки не зібрана.",
            startTest: "Почати доша-тест",
            routeSummaryLabel: "Маршрут",
            routeSummaryTitle: "Коротка карта маршруту",
            summaryActivePrograms: "Активні програми",
            summaryCompletedPrograms: "Завершені маршрути",
            summaryProducts: "Продукти в профілі",
            summaryActiveProgramsValue: activePrograms.length > 0 ? `${activePrograms.length}` : "Поки немає",
            summaryCompletedProgramsValue: completedPrograms.length > 0 ? `${completedPrograms.length}` : "Поки немає",
            summaryProductsValue: productPurchases.length > 0 ? `${productPurchases.length}` : "Поки немає",
            programsLabel: "Програми",
            programsTitle: "Активні та завершені маршрути",
            activeProgramLabel: "Активна програма",
            completedProgramLabel: "Завершений маршрут",
            routeStarted: "Старт маршруту",
            purchasedAt: "Дата покупки",
            accessStatus: "Стан доступу",
            programProgressNote: "Детальний поступ по уроках з’явиться тут, коли платформа почне зберігати проходження програми.",
            programAccessManual: "Доступ активується вручну",
            programAccessNoToken: "Маршрут був оформлений без окремого токена доступу",
            noProgramsLead: "Поки немає програм, прив’язаних до цього профілю.",
            productsTitle: "Куплені формати підтримки",
            productLabel: "Продукт",
            price: "Сума",
            productNoAccess: "Ще не створено",
            noProductsLead: "Куплених продуктів, прив’язаних до цього профілю, поки не знайдено.",
            progressLabel: "Поступ",
            progressTitle: "Проходження програм",
            progressLead: "Поступ програм з’явиться тут, коли платформа почне зберігати проходження уроків і програм.",
            contactsTitle: "Збережені контактні поля",
            name: "Ім’я",
            email: "Email",
            phone: "Телефон",
            telegram: "Telegram",
            unavailableTitle: "Профіль тимчасово недоступний",
            unavailableLead: "Google auth для цієї збірки не увімкнено, тому персональний профіль тут поки не працює.",
            errorTitle: "Не вдалося зібрати профіль",
            errorFallback: "Спробуйте оновити сторінку трохи пізніше.",
            emptyValue: "—",
            doshaLabels: { vata: "Вата", pitta: "Пітта", kapha: "Капха" },
          },
    [lang, activePrograms.length, completedPrograms.length, productPurchases.length],
  );

  const dateLocale = lang === "en" ? "en-US" : "uk-UA";

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  useEffect(() => {
    if (!isAuthEnabled) {
      return;
    }

    const boot = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setSession(data.session);

      if (!data.session?.access_token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/platform/users/me/profile", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      if (!res.ok) {
        setError("Не вдалося завантажити профіль.");
        setLoading(false);
        return;
      }

      const json = (await res.json()) as ProfileResponse;
      setProfile(json);
      setLoading(false);
    };

    void boot();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [isAuthEnabled]);

  const scoreBars = useMemo(() => {
    const scores = profile?.profile.dosha?.scores;
    if (!scores) return [];
    const max = Math.max(scores.vata ?? 0, scores.pitta ?? 0, scores.kapha ?? 0, 1);
    return [
      { key: "vata", label: copy.doshaLabels.vata, value: scores.vata ?? 0, width: `${Math.max(12, Math.round(((scores.vata ?? 0) / max) * 100))}%` },
      { key: "pitta", label: copy.doshaLabels.pitta, value: scores.pitta ?? 0, width: `${Math.max(12, Math.round(((scores.pitta ?? 0) / max) * 100))}%` },
      { key: "kapha", label: copy.doshaLabels.kapha, value: scores.kapha ?? 0, width: `${Math.max(12, Math.round(((scores.kapha ?? 0) / max) * 100))}%` },
    ];
  }, [copy.doshaLabels.kapha, copy.doshaLabels.pitta, copy.doshaLabels.vata, profile]);

  if (!isAuthEnabled) {
    return (
      <section className={`${styles.container} ${styles.section}`}>
        <article className={styles.panel}>
          <p className={styles.label}>{copy.profile}</p>
          <h1 className={styles.title}>{copy.unavailableTitle}</h1>
          <p className={styles.lead}>{copy.unavailableLead}</p>
        </article>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={`${styles.container} ${styles.section}`}>
        <article className={styles.panel}>
          <p className={styles.label}>{copy.profile}</p>
          <h1 className={styles.title}>{copy.loadingTitle}</h1>
          <p className={styles.lead}>{copy.loadingLead}</p>
        </article>
      </section>
    );
  }

  if (!session?.user) {
    return (
      <main className={styles.profileEmptyMain} data-cw-platform-template="profile-empty">
        <section className={`${styles.container} ${styles.section} ${styles.profileEmptySection}`}>
          <article className={`${styles.panel} ${styles.profileEmptyPanel}`}>
          <p className={styles.label}>{copy.profile}</p>
          <h1 className={styles.title}>{copy.authTitle}</h1>
          <p className={styles.lead}>{copy.authLead}</p>
          <div className={`${styles.heroFooter} ${styles.profileEmptyActions}`}>
            <button className={styles.primaryButton} type="button" onClick={() => void signInWithGoogle()}>
              {copy.signIn}
            </button>
            <Link className={styles.secondaryButton} href={homeHref}>
              {copy.returnHome}
            </Link>
          </div>
          </article>
        </section>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <section className={`${styles.container} ${styles.section}`}>
        <article className={styles.panel}>
          <p className={styles.label}>{copy.profile}</p>
          <h1 className={styles.title}>{copy.errorTitle}</h1>
          <p className={styles.lead}>{error ?? copy.errorFallback}</p>
        </article>
      </section>
    );
  }

  const { account, contacts, dosha } = profile.profile;

  return (
    <main className={styles.profileMain} data-cw-platform-template="profile">
      <section
        className={styles.heroFeature}
        data-cw-profile-hero="true"
        data-cw-topbar-tone="dark"
        data-cw-semantic-role="progress"
        data-cw-semantic-family="guide-trust"
        data-cw-token-source="global-app-ds"
      >
        <div className={styles.heroPhotoLayer} aria-hidden="true" />
        <div className={styles.heroFeatureContent}>
          <p className={styles.heroBadge}>
            <span>{copy.badge}</span>
          </p>
          <article className={styles.profileHeroIdentityCard}>
            <div className={styles.profileHeroIdentity}>
              <span className={styles.profileHeroAvatar} aria-hidden="true">
                {account.avatarUrl ? (
                  // Remote auth avatars stay on plain img to avoid introducing image config coupling into platform profile.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  getUserInitial(session, account.fullName)
                )}
              </span>
              <div className={styles.panelIntro}>
                <p className={styles.profileHeroKicker}>{copy.profile}</p>
                <h1 className={styles.detailHeroTitle}>{account.fullName ?? "Ваш профіль CenterWay"}</h1>
                <p className={styles.heroFeatureLead}>{account.email ?? "Google-профіль підключено до CenterWay"}</p>
              </div>
            </div>
          </article>
          <div className={styles.profileStatGrid}>
            <article className={styles.profileStatCard} data-tone="guide">
              <p className={styles.label}>{copy.dosha}</p>
              <strong>{formatDoshaResult(dosha?.resultType, lang)}</strong>
            </article>
            <article className={styles.profileStatCard} data-tone="support">
              <p className={styles.label}>{copy.activePrograms}</p>
              <strong>{activePrograms.length > 0 ? copy.hasPrograms : copy.noPrograms}</strong>
            </article>
            <article className={styles.profileStatCard} data-tone="proof">
              <p className={styles.label}>{copy.products}</p>
              <strong>{productPurchases.length > 0 ? copy.hasProducts : copy.noProducts}</strong>
            </article>
          </div>
          <div className={styles.profileHeroActions}>
            <Link className={styles.primaryButton} href={dosha ? "#profile-dosha" : doshaTestHref}>
              {dosha ? copy.heroViewDosha : copy.takeDosha}
            </Link>
            <button className={styles.secondaryButton} type="button" onClick={() => void signOut()}>
              {copy.signOut}
            </button>
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="profile-dosha">
        <div className={`${styles.grid2} ${styles.profileGridPair}`}>
          <article className={styles.panel}>
            <p className={styles.label}>{copy.dosha}</p>
            <h2 className={styles.title}>{copy.doshaCurrent}</h2>
            {dosha ? (
              <div className={styles.panelStack}>
                <ul className={styles.timeline}>
                  <li>{copy.dosha}: {formatDoshaResult(dosha.resultType, lang)}</li>
                  <li>{copy.completedShort}: {fmtShortDate(dosha.completedAt, dateLocale)}</li>
                </ul>
                <div className={styles.profileScoreList}>
                  {scoreBars.map((item) => (
                    <div key={item.key} className={styles.profileScoreRow}>
                      <div className={styles.profileScoreMeta}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                      <div className={styles.profileScoreTrack}>
                        <span className={styles.profileScoreFill} style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.heroFooter}>
                  <Link className={styles.secondaryButton} href={doshaTestHref}>
                    {copy.retakeTest}
                  </Link>
                </div>
              </div>
            ) : (
              <div className={styles.panelStack}>
                <p className={styles.lead}>{copy.doshaEmptyLead}</p>
                <div className={styles.heroFooter}>
                  <Link className={styles.primaryButton} href={doshaTestHref}>
                    {copy.startTest}
                  </Link>
                </div>
              </div>
            )}
          </article>

          <article className={styles.panel}>
            <p className={styles.label}>{copy.routeSummaryLabel}</p>
            <h2 className={styles.title}>{copy.routeSummaryTitle}</h2>
            <ul className={styles.profileSummaryList}>
              <li>
                {copy.summaryActivePrograms}
                <strong>{copy.summaryActiveProgramsValue}</strong>
              </li>
              <li>
                {copy.summaryCompletedPrograms}
                <strong>{copy.summaryCompletedProgramsValue}</strong>
              </li>
              <li>
                {copy.summaryProducts}
                <strong>{copy.summaryProductsValue}</strong>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.label}>{copy.programsLabel}</p>
            <h2 className={styles.sectionTitle}>{copy.programsTitle}</h2>
          </div>
        </div>
        {activePrograms.length > 0 || completedPrograms.length > 0 ? (
          <div className={`${styles.grid2} ${styles.profileGridPair}`}>
            {activePrograms.map((purchase) => (
              <article key={`active-${purchase.orderRef}`} className={styles.panel}>
                <p className={styles.label}>{copy.activeProgramLabel}</p>
                <h3 className={styles.title}>{purchase.title}</h3>
                <ul className={styles.timeline}>
                  <li>{copy.routeStarted}: {fmtDate(purchase.createdAt, dateLocale)}</li>
                  <li>{copy.accessStatus}: {purchase.access ? formatAccessStatus(purchase.access.used, purchase.access.expires_at, lang) : copy.programAccessManual}</li>
                  <li>{copy.programProgressNote}</li>
                </ul>
              </article>
            ))}
            {completedPrograms.map((purchase) => (
              <article key={`completed-${purchase.orderRef}`} className={styles.panel}>
                <p className={styles.label}>{copy.completedProgramLabel}</p>
                <h3 className={styles.title}>{purchase.title}</h3>
                <ul className={styles.timeline}>
                  <li>{copy.purchasedAt}: {fmtDate(purchase.createdAt, dateLocale)}</li>
                  <li>{copy.accessStatus}: {purchase.access ? formatAccessStatus(purchase.access.used, purchase.access.expires_at, lang) : copy.programAccessNoToken}</li>
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <article className={styles.panel}>
            <p className={styles.lead}>{copy.noProgramsLead}</p>
          </article>
        )}
      </section>

      <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.label}>{copy.products}</p>
            <h2 className={styles.sectionTitle}>{copy.productsTitle}</h2>
          </div>
        </div>
        {productPurchases.length > 0 ? (
          <div className={`${styles.grid2} ${styles.profileGridPair}`}>
            {productPurchases.map((purchase) => (
              <article key={purchase.orderRef} className={styles.panel}>
                <p className={styles.label}>{copy.productLabel}</p>
                <h3 className={styles.title}>{purchase.title}</h3>
                <ul className={styles.timeline}>
                  <li>{copy.purchasedAt}: {fmtDate(purchase.createdAt, dateLocale)}</li>
                  <li>{copy.price}: {fmtMoney(purchase.amount, purchase.currency)}</li>
                  <li>{copy.accessStatus}: {purchase.access ? formatAccessStatus(purchase.access.used, purchase.access.expires_at, lang) : copy.productNoAccess}</li>
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <article className={styles.panel}>
            <p className={styles.lead}>{copy.noProductsLead}</p>
          </article>
        )}
      </section>

      <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}>
        <div className={`${styles.grid2} ${styles.profileGridPair}`}>
          <article className={styles.panel}>
            <p className={styles.label}>{copy.progressLabel}</p>
            <h2 className={styles.title}>{copy.progressTitle}</h2>
            <p className={styles.lead}>{copy.progressLead}</p>
          </article>

          <article className={styles.panel}>
            <p className={styles.label}>{copy.contacts}</p>
            <h2 className={styles.title}>{copy.contactsTitle}</h2>
            <ul className={styles.timeline}>
              <li>{copy.name}: {account.fullName ?? copy.emptyValue}</li>
              <li>{copy.email}: {account.email ?? copy.emptyValue}</li>
              <li>{copy.phone}: {contacts?.phone ?? copy.emptyValue}</li>
              <li>{copy.telegram}: {contacts?.telegram ?? copy.emptyValue}</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
