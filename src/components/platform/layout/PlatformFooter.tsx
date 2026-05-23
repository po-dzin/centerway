"use client";

import Link from "next/link";
import { contact, platformHomeHref, socialLinks } from "@/lib/platform/content";
import styles from "@/components/platform/PlatformShellStyles";
import { PLATFORM_SITE_ORIGIN, useIsBrandedHost } from "./usePlatformHref";

export function PlatformFooter() {
  const isBrandedHost = useIsBrandedHost();
  const homeHref = isBrandedHost ? `${PLATFORM_SITE_ORIGIN}${platformHomeHref}` : platformHomeHref;
  const publicOfferHref = isBrandedHost ? `${PLATFORM_SITE_ORIGIN}/legal/public-offer` : "/legal/public-offer";
  const privacyHref = isBrandedHost ? `${PLATFORM_SITE_ORIGIN}/legal/privacy` : "/legal/privacy";

  return (
    <footer className={styles.footer} data-platform-footer="true">
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div className={styles.footerBrandBlock}>
          <Link className={styles.brand} href={homeHref} aria-label="CenterWay" data-surface="footer">
            <span className={styles.brandSymbol} aria-hidden="true" />
            <span className={styles.footerBrandText}>CENTERWAY</span>
          </Link>
          <p className={styles.footerLead}>Аюрведичні програми, консультації та практики відновлення.</p>
        </div>
        <div className={`${styles.footerLinks} ${styles.footerLegal}`}>
          <Link href={publicOfferHref}>Публічний договір</Link>
          <Link href={privacyHref}>Політика конфіденційності</Link>
        </div>
        <div className={`${styles.footerLinks} ${styles.footerSocials}`}>
          <a href={`tel:${contact.phone.replace(/\s+/g, "")}`}>{contact.phone}</a>
          <div className={styles.footerSocialsRow}>
            {socialLinks.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
                <span className={styles.footerSocialIcon} data-network={item.network} aria-hidden="true" />
                <span className={styles.srOnly}>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
