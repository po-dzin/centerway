/**
 * «Стрічка» — `/feed` and `/feed/[id]` (2026-10-16).
 *
 * SEMANTIC PREFLIGHT (RAverse canon not read — unreachable from the cloud
 * session; docs/CANON.md and docs/platform_agent_preflight.md used).
 * - semantic_role: спільнота (primary), орієнтація (secondary): what the
 *   authors are saying now, and where it leads in the catalogue.
 * - user_question: «Що нового від авторів, про що мені це, і куди піти далі?»
 * - token_source: global DS — card, chip, shelf filter popover, button roles;
 *   no palette, radius, shadow or type scale of its own (Feed.module.css).
 *   The top is a photo hero (17.10, `FeedHero`): the page's h1 over a baked
 *   photo and a directional scrim of `--cw-mat-scrim-ink`.
 * - content_source: `feed_posts` and their reactions and comments through
 *   lib/feed/server; attached blocks read live from `lms_lessons`.
 * - route_boundary: `/feed` on the public host, open without sign-in;
 *   reacting, commenting and marking ask for an account.
 * - selection_family: filter `contour` + `hybrid` rows (the shelf's recipe);
 *   reaction and topic chips `fill`; text actions `ink`.
 */

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { FEED_PATH, type FeedFilter } from "@/lib/feed/model";
import type { FeedAuthor, FeedPage as Page, FeedPost } from "@/lib/feed/server";

import { feedCopy } from "./copy";
import { FeedHeading, FeedStage } from "./FeedHero";
import { FeedSingle, FeedView } from "./FeedView";
import styles from "./Feed.module.css";

export function FeedPage({ page, authors, filter }: { page: Page; authors: FeedAuthor[]; filter: FeedFilter }) {
  return (
    <main className={styles.wall} data-cw-hero="bleed">
      <FeedStage />
      <div className={`${styles.page} ${styles.pageOnWall}`}>
        <FeedView head={<FeedHeading />} initial={page} authors={authors} filter={filter} />
      </div>
    </main>
  );
}

export function FeedPostPage({ post }: { post: FeedPost }) {
  return (
    <main className={styles.page}>
      {/* The header's back arrow lives on a phone only; a desktop reader gets the way back here. */}
      <Link className={styles.backLink} href={FEED_PATH}>
        <Icon name="arrow-left" size={20} />
        <span className={styles.backText}>{feedCopy.backToFeed}</span>
      </Link>
      <FeedSingle initial={post} />
    </main>
  );
}
