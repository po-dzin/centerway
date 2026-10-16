/**
 * «Свіже від авторів» — the feed's three latest posts on the home page, right
 * above «Автори»: first what the authors are saying now, then who they are.
 *
 * Absent when there is nothing to show — before the first post, and when the
 * feed could not be read. The home page never shows an empty shelf for it.
 */

import Link from "next/link";

import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { COURSE_CATEGORY_LABELS } from "@/lib/platform/catalogVocabulary";
import { plural } from "@/lib/plural";
import { EMPTY_FEED_FILTER, FEED_PATH, feedPostPath } from "@/lib/feed/model";
import { readFeedFirstPage } from "@/lib/feed/page";

import { feedCopy, relativeTime } from "./copy";
import { Emoji } from "./FeedReactions";
import styles from "./Feed.module.css";

export async function FeedFresh() {
  const { page } = await readFeedFirstPage(EMPTY_FEED_FILTER, { limit: 3, authorId: null });
  if (page.posts.length === 0) return null;

  return (
    <PlatformBlock
      id="fresh"
      label={feedCopy.freshLabel}
      title={feedCopy.freshTitle}
      lead={feedCopy.freshLead}
      headActions={<PlatformBlockLink href={FEED_PATH} label={feedCopy.freshAll} />}
    >
      <ul className={styles.fresh}>
        {page.posts.map((post) => {
          const top = post.reactions[0];
          const when = post.publishedAt ?? post.createdAt;
          return (
            <li key={post.id}>
              <article className={styles.freshCard}>
                <div className={styles.byline}>
                  <AuthorPortrait
                    photo={post.author.photo}
                    size="xs"
                    fallback={post.author.name.trim().charAt(0).toUpperCase()}
                  />
                  <p className={styles.when}>
                    {post.author.name} ·{" "}
                    <time dateTime={when} suppressHydrationWarning>
                      {relativeTime(when)}
                    </time>
                  </p>
                </div>
                <p className={styles.freshText}>
                  <Link className={styles.freshLink} href={feedPostPath(post.id)}>
                    {post.body}
                  </Link>
                </p>
                <p className={styles.freshMeta}>
                  <span>{COURSE_CATEGORY_LABELS[post.topic]}</span>
                  {top ? (
                    <span className={styles.freshReaction}>
                      <Emoji id={top.emoji} />
                      {top.count}
                    </span>
                  ) : null}
                  {post.commentCount > 0 ? (
                    <span>{`${post.commentCount} ${plural(post.commentCount, ...feedCopy.comments)}`}</span>
                  ) : null}
                </p>
              </article>
            </li>
          );
        })}
      </ul>
    </PlatformBlock>
  );
}
