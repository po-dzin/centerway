/**
 * «Стрічка · початок» (feed mockup, 16.10): the pinned word from CenterWay
 * that opens the unfiltered feed, and on launch day — before any author has
 * posted — three cards for what the feed will carry, instead of an empty page.
 *
 * Once posts appear the welcome stays first and the three cards go: they
 * describe a feed that does not exist yet. A filtered feed shows neither — the
 * reader asked for one topic or author, not for the introduction.
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
  { icon: "breath", title: feedCopy.willPractices, text: feedCopy.willPracticesText },
  { icon: "quote", title: feedCopy.willThoughts, text: feedCopy.willThoughtsText },
  { icon: "calendar", title: feedCopy.willEvents, text: feedCopy.willEventsText },
] as const;

export function FeedWelcome({ launch }: { launch: boolean }) {
  return (
    <>
      <article className={styles.post} aria-labelledby="feed-welcome-title">
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
        <FeedAttachment attachment={FREE} />
      </article>
      {launch ? (
        <div className={styles.willGrid}>
          {KINDS.map((kind) => (
            <section className={styles.willCard} key={kind.title}>
              <Icon name={kind.icon} size={24} />
              <h2 className={styles.willTitle}>{kind.title}</h2>
              <p className={styles.willText}>{kind.text}</p>
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
}
