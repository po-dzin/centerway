import Link from "next/link";

import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { authorHref } from "@/lib/lms/authorRoutes";
import type { Author } from "@/lms-core";
import styles from "./AuthorByline.module.css";

/**
 * Whose work this is, in one line: a small round face, the name, the role.
 *
 * For the surfaces that need authorship without a page's worth of it — the
 * intro of a test. `AuthorCard` is the object for previewing a person; this is
 * the object for signing a piece of work.
 *
 * The row links to the profile only when the author has published one — the
 * same rule as the programme page's byline: a person who has not asked for a
 * page is not linked from everything they wrote. Unlisted, it is a plain line.
 */
export function AuthorByline({ author }: { author: Author }) {
  const body = (
    <>
      <AuthorPortrait photo={author.photo} size="xs" fallback={author.name.trim().charAt(0).toUpperCase()} />
      <span className={styles.text}>
        <span className={styles.name}>
          {author.listed ? <InteractionInkLabel variant="navigation">{author.name}</InteractionInkLabel> : author.name}
        </span>
        {author.role ? <span className={styles.role}>{author.role}</span> : null}
      </span>
    </>
  );

  return author.listed ? (
    <Link className={styles.byline} href={authorHref(author)} data-cw-ink-control data-cw-author-byline="">
      {body}
    </Link>
  ) : (
    <div className={styles.byline} data-cw-author-byline="">
      {body}
    </div>
  );
}
