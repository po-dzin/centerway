"use client";

import Link from "next/link";
import { LEARNING_SHELF_HREF, contact, platformHomeHref, socialLinks } from "@/lib/platform/content";
import styles from "@/components/platform/PlatformShellStyles";
import { SUPPORT_BOT_URL } from "@/lib/tgSupportBotCopy";
import { useSurfaceHref } from "./SurfaceHost";
import { PwaInstallFooterEntry } from "@/components/platform/cabinet/PwaInstallCard";

/**
 * `minimal` is the learning footer.
 *
 * The full footer is a storefront close: brand promise, phone number, four
 * social networks, legal. Under a lesson it was the loudest thing on the page
 * and every item in it led away — a reader who scrolled past the last block of
 * day 8 landed in Instagram links. The minimal variant keeps only what someone
 * mid-course can actually need: back to the shelf, support, and the legal pair
 * we are obliged to carry on every page.
 *
 * The install entry sits here in both variants. It is a standing offer, made
 * once per device, and standing offers belong at the bottom of every page
 * rather than in a panel at the top of two of them. It renders itself away
 * where there is nothing to offer — on `www`, without a live prompt, or once
 * the app is already installed.
 */
/* Short on purpose: it stands in a column of three-word links, and the card's
   full sentence would be the one item that wraps. */
const INSTALL_LABEL = "Додати на екран";

export function PlatformFooter({ variant = "full" }: { variant?: "full" | "minimal" }) {
  const href = useSurfaceHref();
  const homeHref = href(platformHomeHref);
  const shelfHref = href(LEARNING_SHELF_HREF);
  const publicOfferHref = href("/legal/public-offer");
  const privacyHref = href("/legal/privacy");

  if (variant === "minimal") {
    return (
      <footer className={styles.footer} data-platform-footer="minimal">
        <div className={`${styles.container} ${styles.footerLearnRow}`}>
          <Link href={shelfHref}>Мої курси</Link>
          <a href={SUPPORT_BOT_URL} target="_blank" rel="noopener noreferrer">
            Підтримка
          </a>
          <Link href={publicOfferHref}>Публічний договір</Link>
          <Link href={privacyHref}>Політика конфіденційності</Link>
          <PwaInstallFooterEntry label={INSTALL_LABEL} />
        </div>
      </footer>
    );
  }

  return (
    <footer className={styles.footer} data-platform-footer="true">
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div className={styles.footerBrandBlock}>
          <Link className={styles.brand} href={homeHref} aria-label="CenterWay" data-surface="footer">
            <span className={styles.brandSymbol} aria-hidden="true" />
            <span className={styles.footerBrandText}>CENTERWAY</span>
          </Link>
          {/* Placeholder wording pending the owner's line. The old one named
              ayurveda and consultations only, which stopped describing the
              platform once the LMS, the dosha test and the product shelf landed;
              this one names the shape of the offer instead of one modality. */}
          <p className={styles.footerLead}>Курси, практики та супровід — тіло, ритм і опора у власному темпі.</p>
        </div>
        <div className={`${styles.footerLinks} ${styles.footerLegal}`}>
          <Link href={publicOfferHref}>Публічний договір</Link>
          <Link href={privacyHref}>Політика конфіденційності</Link>
          <PwaInstallFooterEntry label={INSTALL_LABEL} />
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
