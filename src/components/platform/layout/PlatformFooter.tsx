"use client";

import Link from "next/link";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { LEARNING_SHELF_HREF, contact, platformHomeHref, socialLinks } from "@/lib/platform/content";
import styles from "@/components/platform/PlatformShellStyles";
import { SUPPORT_BOT_URL } from "@/lib/tgSupportBotCopy";
import { useSurfaceHref } from "./SurfaceHost";

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
 * NO INSTALL ENTRY, in either. It used to sit in both columns as a standing
 * offer, which put a third copy of it one scroll below the account menu that
 * carries it on every page — and on the learning tree, which renders no footer
 * at all, that copy was never reachable anyway. The offer is in the menu and in
 * the cabinet; see `InstallEntry` in `PlatformAccountMenu.tsx`.
 *
 * NO LEGAL PAIR ON `my`, by decision. The offer and the privacy policy are
 * carried on every page of `www`, which is where the selling happens and where
 * they are read before a purchase. Repeating them under a lesson and under the
 * builder put a contract at the bottom of a page whose reader has already
 * signed it. They stay one link away — from the shop, and from any receipt.
 */

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
        <div className={`${styles.container} ${styles.footerGrid} ${styles.footerGridPersonal}`}>
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
          </div>
          {/* TWO LINK COLUMNS, SPLIT BY WHAT THEY ARE. The first is this
              application's own pages — the places a reader goes to keep working.
              The second is everything that leaves it or changes the device:
              support opens a chat elsewhere, and install is an OS affordance,
              not a page. Four rows in one column read as one undifferentiated
              stack where the storefront footer beside it has three tracks, so
              the two footers disagreed about their own shape. */}
          <div className={`${styles.footerLinks} ${styles.footerLegal}`}>
            <Link className={styles.footerTextLink} href={shelfHref} data-cw-ink-control>
              <InteractionInkLabel>Мої матеріали</InteractionInkLabel>
            </Link>
            <Link className={styles.footerTextLink} href={profileHref} data-cw-ink-control>
              <InteractionInkLabel>Кабінет</InteractionInkLabel>
            </Link>
          </div>
          <div className={`${styles.footerLinks} ${styles.footerSocials}`}>
            <a className={styles.footerTextLink} href={SUPPORT_BOT_URL} target="_blank" rel="noopener noreferrer" data-cw-ink-control>
              <InteractionInkLabel>Підтримка</InteractionInkLabel>
            </a>
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
          <p className={styles.footerLead}>
            {PERSONAL_LEAD.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        </div>
        <div className={`${styles.footerLinks} ${styles.footerLegal}`}>
          <Link className={styles.footerTextLink} href={publicOfferHref} data-cw-ink-control>
            <InteractionInkLabel>Публічний договір</InteractionInkLabel>
          </Link>
          <Link className={styles.footerTextLink} href={privacyHref} data-cw-ink-control>
            <InteractionInkLabel>Політика конфіденційності</InteractionInkLabel>
          </Link>
        </div>
        <div className={`${styles.footerLinks} ${styles.footerSocials}`}>
          <a className={styles.footerTextLink} href={`tel:${contact.phone.replace(/\s+/g, "")}`} data-cw-ink-control>
            <InteractionInkLabel>{contact.phone}</InteractionInkLabel>
          </a>
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
      <p className={`${styles.container} ${styles.footerBugNote}`}>
        Платформа наразі неідеальна, як і все у цьому світі. Якщо ви знайшли помилку — {" "}
        <a className={styles.footerTextLink} href={`${SUPPORT_BOT_URL}?start=bug`} target="_blank" rel="noopener noreferrer" data-cw-ink-control>
          <InteractionInkLabel>дайте нам знати</InteractionInkLabel>
        </a>.
      </p>
    </footer>
  );
}
