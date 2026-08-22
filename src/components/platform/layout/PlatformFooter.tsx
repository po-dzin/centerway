"use client";

import Link from "next/link";
import { LEARNING_SHELF_HREF, contact, platformHomeHref, socialLinks } from "@/lib/platform/content";
import styles from "@/components/platform/PlatformShellStyles";
import { SUPPORT_BOT_URL } from "@/lib/tgSupportBotCopy";
import { useSurfaceHref } from "./SurfaceHost";
import { PwaInstallFooterEntry } from "@/components/platform/cabinet/PwaInstallCard";

/**
 * TWO FOOTERS, ONE PER APPLICATION — not one per page.
 *
 * `full` is the storefront's close: brand promise, phone number, four social
 * networks, legal. `personal` is the same SHAPE — the same three-column grid,
 * the same brand block, the same link rhythm — carrying what somebody inside
 * their own environment can use: their courses, their profile, support, legal,
 * and the install offer.
 *
 * IT USED TO BE A NAKED ROW. The learning footer was one wrapping line of plain
 * links with no brand at all, which meant `my` ended two ways depending on the
 * page: a lesson closed on a caption-weight row, the shelf on nothing much
 * else. Two endings for one application is one too many, and neither of them
 * said whose application it was.
 *
 * WHAT `personal` DOES NOT CARRY is the social row and the phone. That was the
 * whole point of the stripped variant and it still holds: nobody on `my` is
 * being sold to, every one of those links leaves the origin, and a reader who
 * scrolled past the last block of day 8 should not land in Instagram. Dropping
 * them is a different act from dropping the brand.
 *
 * The install entry sits in both. It is a standing offer, made once per device,
 * and it renders itself away where there is nothing to offer — on `www`,
 * without a live prompt, or once the app is already installed.
 *
 * NO LEGAL PAIR ON `my`, by decision. The offer and the privacy policy are
 * carried on every page of `www`, which is where the selling happens and where
 * they are read before a purchase. Repeating them under a lesson and under the
 * builder put a contract at the bottom of a page whose reader has already
 * signed it. They stay one link away — from the shop, and from any receipt.
 */

/* Short on purpose: it stands in a column of three-word links, and the card's
   full sentence would be the one item that wraps. */
const INSTALL_LABEL = "Додати на екран";

/* Not the storefront's promise — nobody here is being sold to, and this is the
   author's line rather than a description of the software. Two short sentences,
   set as two lines: the break is the pause. */
const PERSONAL_LEAD = ["Місце уважної присутності.", "Тут тихо."];

export function PlatformFooter({ variant = "full" }: { variant?: "full" | "personal" }) {
  const href = useSurfaceHref();
  const homeHref = href(platformHomeHref);
  const shelfHref = href(LEARNING_SHELF_HREF);
  const profileHref = href("/profile");
  const publicOfferHref = href("/legal/public-offer");
  const privacyHref = href("/legal/privacy");

  if (variant === "personal") {
    return (
      <footer className={styles.footer} data-platform-footer="personal">
        <div className={`${styles.container} ${styles.footerGridPersonal}`}>
          <div className={styles.footerBrandBlock}>
            {/* The root of THIS application, like the header's mark. Pointing
                the personal footer at the storefront would make the one control
                that never changes the one that leaves. */}
            <Link className={styles.brand} href={shelfHref} aria-label="CenterWay" data-surface="footer">
              <span className={styles.brandSymbol} aria-hidden="true" />
              <span className={styles.footerBrandText}>CENTERWAY</span>
            </Link>
            {/* `.footerLead` is a grid, so each sentence is its own row. A
                `<br>` inside a grid container is a grid item, not a break. */}
            <p className={styles.footerLead}>
              {PERSONAL_LEAD.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          </div>
          <div className={styles.footerLinks}>
            <Link href={shelfHref}>Мої курси</Link>
            <Link href={profileHref}>Профіль</Link>
            <a href={SUPPORT_BOT_URL} target="_blank" rel="noopener noreferrer">
              Підтримка
            </a>
            {/* In the links column, not a column of its own: it renders itself
                away most of the time, and a track that is empty on almost every
                visit is a gap the other two have to be laid out around. */}
            <PwaInstallFooterEntry label={INSTALL_LABEL} />
          </div>
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
