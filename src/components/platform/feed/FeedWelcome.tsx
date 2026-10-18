/**
 * The pinned post of CenterWay, taped to the wall under the title (G
 * 2026-10-18). One line and one way in — nothing the title above it already
 * says. What the feed carries is the page's own lead; this post only answers
 * «з чого почати», with the free shelf as the answer.
 *
 * It stays whole inside the first screen on a desktop and on a phone: that is
 * why it is this short. Before any author has posted, only its line changes. A
 * filtered feed does not show it — the reader asked for one topic or author,
 * not for a way in.
 *
 * The card leads to the real free shelf (`/programs?free=1`, the home page's
 * «Усі безкоштовні»).
 */

import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { programAttachment } from "@/lib/feed/attachment";

import { feedCopy } from "./copy";
import { FeedAttachment } from "./FeedAttachment";
import styles from "./Feed.module.css";

const FREE = {
  ...programAttachment({ title: feedCopy.welcomeFree, slug: null, programSlug: null }),
  meta: feedCopy.welcomeFreeMeta,
  href: "/programs?free=1",
};

export function FeedWelcome({ launch }: { launch: boolean }) {
  return (
    <article className={`${styles.post} ${styles.pinned}`} aria-label={feedCopy.pinnedLabel}>
      <div className={styles.byline}>
        <span className={styles.face} aria-hidden="true">
          <AuthorPortrait photo={null} size="xs" fallback="C" />
        </span>
        <div className={styles.who}>
          <p className={styles.whoName}>
            CenterWay <span className={styles.pinTag}>· {feedCopy.pinned}</span>
          </p>
        </div>
      </div>
      <p className={styles.welcomeText}>{launch ? feedCopy.welcomeLaunch : feedCopy.welcomeText}</p>
      <FeedAttachment attachment={FREE} />
    </article>
  );
}
