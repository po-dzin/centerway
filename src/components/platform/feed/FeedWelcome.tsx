/**
 * The pinned post of CenterWay, taped to the wall under the title (G
 * 2026-10-18). It is where the page says what it is about — practices,
 * thoughts, events — so the title above it carries no lead of its own, and the
 * two never say the same thing twice. Then one way in: the free shelf.
 *
 * It stays whole inside the first screen on a desktop and on a phone, which is
 * why each line is a few words. Before any author has posted, its byline adds
 * one line. A filtered feed does not show it — the reader asked for one
 * topic or author, not for the introduction.
 *
 * The card leads to the real free shelf (`/programs?free=1`, the home page's
 * «Усі безкоштовні»).
 */

import { Icon } from "@/components/Icon";
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

const KINDS = [
  { icon: "body", title: feedCopy.willPractices, text: feedCopy.willPracticesText },
  { icon: "quote", title: feedCopy.willThoughts, text: feedCopy.willThoughtsText },
  { icon: "calendar", title: feedCopy.willEvents, text: feedCopy.willEventsText },
] as const;

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
          {launch ? <p className={styles.when}>{feedCopy.welcomeLaunch}</p> : null}
        </div>
      </div>
      <ul className={styles.willList}>
        {KINDS.map((kind) => (
          <li className={styles.willItem} key={kind.title}>
            <Icon className={styles.willIcon} name={kind.icon} size={20} />
            <span>
              <b className={styles.willTitle}>{kind.title}</b> <span className={styles.willText}>{kind.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <FeedAttachment attachment={FREE} />
    </article>
  );
}
