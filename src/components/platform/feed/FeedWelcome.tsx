/**
 * «Стрічка · початок» (feed mockup, 16.10): the pinned word from CenterWay
 * that opens the unfiltered feed. What the feed carries — practices, thoughts,
 * events — is three lines inside that one post (G 17.10: «одного поста
 * достатньо, 3 картки вбудуй у перший пост»), not cards of their own.
 *
 * On launch day, before any author has posted, only its opening sentence
 * changes. A filtered feed does not show it — the reader asked for one topic
 * or author, not for the introduction.
 *
 * The mockup's practice («Дихання 4–6») was a placeholder; the card leads to
 * the real free shelf (`/programs?free=1`, the home page's «Усі безкоштовні»).
 */

import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { Icon } from "@/components/Icon";
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
    <article className={`${styles.post} ${styles.pinned}`} aria-labelledby="feed-welcome-title">
      <div className={styles.byline}>
        <span className={styles.face} aria-hidden="true">
          <AuthorPortrait photo={null} size="sm" fallback="C" />
        </span>
        <div className={styles.who}>
          <p className={styles.whoName}>
            CenterWay <span className={styles.pinTag}>· {feedCopy.pinned}</span>
          </p>
          <p className={styles.when}>{feedCopy.welcomeBy}</p>
        </div>
      </div>
      <h2 className={styles.welcomeTitle} id="feed-welcome-title">
        {feedCopy.welcomeTitle}
      </h2>
      <p className={styles.welcomeText}>{launch ? feedCopy.welcomeLaunch : feedCopy.welcomeText}</p>
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
