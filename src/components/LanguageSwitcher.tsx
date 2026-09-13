"use client";

import { useI18n } from "@/components/I18nProvider";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import styles from "@/components/LanguageSwitcher.module.css";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const nextLang = ({ uk: "en", en: "uk" } as const)[lang];
  const toggle = () => setLang(nextLang);
  // The stored locale is the BCP 47 code (`uk`), but the button is read by a
  // person, not a parser — and a person here reads the country label. "UA"
  // on the face, "uk" in storage; the two never meet.
  const label = ({ uk: "UA", en: "EN" } as const)[lang];

  return (
    <button onClick={toggle} type="button" className={styles.button} title={t("common_switch_language")}>
      <InteractionInkIcon>{label}</InteractionInkIcon>
    </button>
  );
}
