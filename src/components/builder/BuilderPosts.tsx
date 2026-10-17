"use client";

/**
 * «Мої дописи» — the author's own posts in «Стрічка», in every state, and how
 * each one landed.
 *
 * SEMANTIC PREFLIGHT (2026-10-16; RAverse canon not read — unreachable from the
 * cloud session, docs/CANON.md and docs/platform_agent_preflight.md used).
 * - semantic_role: прогрес (primary), спільнота (secondary) — the overview's
 *   sibling, density Compact.
 * - user_question: «Що з моїми дописами: що вийшло, що чекає команду, що
 *   повернули й чому, і як на них відгукуються?»
 * - token_source: the feed's own card (Feed.module.css) inside the workshop
 *   shell; no new palette, radius, shadow or type scale.
 * - content_source: `/api/feed/me` — the author's posts in every state, with
 *   the team's reason for a held or returned one.
 * - route_boundary: `/build/dopysy` on the personal host. Writing a new post
 *   happens in «Стрічка» itself (G, 16.10); this room sends a returned post
 *   again and removes a post, nothing else.
 *
 * Views, clicks to the programme and payments from a post are not here yet:
 * nothing counts them. «Облік» already shows what sold from an author's links.
 */

import { useEffect, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { FeedComposer, type ComposerDraft } from "@/components/platform/feed/FeedComposer";
import { FeedPostCard } from "@/components/platform/feed/FeedPostCard";
import { deletePost, fetchFeedMe, type FeedMe } from "@/components/platform/feed/feedApi";
import feedStyles from "@/components/platform/feed/Feed.module.css";
import { useSignInHref } from "@/components/auth/useSignInReturn";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import type { FeedPost } from "@/lib/feed/server";
import { FEED_PATH, emojiName, excerptOf, feedPostPath } from "@/lib/feed/model";
import { feedCopy } from "@/components/platform/feed/copy";
import { BuilderShell } from "./BuilderShell";
import { BuilderWorkshopRail } from "./BuilderWorkshopRail";
import styles from "./Builder.module.css";

/** Reactions named by kind before «і ще N види» (mockup: «Відгукнулось 48 · Вогонь 11 · Практика 6 і ще 5 видів»). */
const ECHO_NAMED = 3;

const STATE_WORDS: Record<FeedPost["status"], string> = {
  published: "у стрічці",
  held: "чекає команду",
  checking: "перевіряється",
  returned: "повернуто",
};

function draftOf(post: FeedPost): ComposerDraft {
  return {
    id: post.id,
    body: post.body,
    topic: post.topic,
    /* Sending again replaces the post whole, so its topics, media and tags
       ride along or they are lost. */
    topics: post.topics,
    media: post.media,
    taggedAuthorIds: post.tagged.map((entry) => entry.id),
    courseId: post.source?.courseId ?? null,
    lessonId: post.source?.lessonId ?? null,
    blockId: post.source?.blockId ?? null,
    full: post.source?.blockDisplay !== "excerpt",
  };
}

export function BuilderPosts() {
  const toast = useToast();
  const surfaceHref = useSurfaceHref();
  const signInHref = useSignInHref(surfaceHref("/profile"));
  const [me, setMe] = useState<FeedMe | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchFeedMe().then((result) => {
      if (cancelled) return;
      if (result.ok) setMe(result.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rail = <BuilderWorkshopRail current="posts" />;
  const write = (
    <a className={styles.overviewTextAction} data-cw-ink-control href={surfaceHref(FEED_PATH)}>
      <InteractionInkLabel variant="link">Написати у стрічці</InteractionInkLabel>
    </a>
  );

  if (!me && !failed) {
    return (
      <BuilderShell aside={rail}>
        <PlatformLoadingState label="Майстерня" title="Збираємо ваші дописи…" detail="Стан, причини й відгуки." />
      </BuilderShell>
    );
  }

  function replace(post: FeedPost) {
    setEditing(null);
    setMe((current) =>
      current ? { ...current, posts: current.posts.map((entry) => (entry.id === post.id ? post : entry)) } : current,
    );
  }

  async function remove(post: FeedPost) {
    if (!window.confirm("Видалити цей допис зі стрічки?")) return;
    const result = await deletePost(post.id);
    if (!result.ok) {
      toast.error("Не вдалося видалити допис.");
      return;
    }
    setMe((current) =>
      current ? { ...current, posts: current.posts.filter((entry) => entry.id !== post.id) } : current,
    );
    toast.success("Допис видалено.");
  }

  return (
    <BuilderShell aside={rail}>
      <PlatformPageHead
        label="Майстерня"
        title="Мої дописи"
        lead="Ваші дописи у стрічці і як на них відгукуються. Новий допис пишеться прямо у стрічці."
        actions={me?.author ? write : undefined}
      />

      {failed ? <p className={feedStyles.empty}>Не вдалося завантажити дописи. Спробуйте оновити сторінку.</p> : null}

      {me && !me.author ? (
        <p className={feedStyles.empty}>
          Дописи у стрічці пишуть автори з відкритим профілем. Коли ваш профіль автора опубліковано, тут з’являться ваші
          дописи.
        </p>
      ) : null}

      {me?.author && me.posts.length === 0 ? (
        <p className={feedStyles.empty}>Ви ще не писали у стрічку. Перший допис пишеться прямо там.</p>
      ) : null}

      {me?.author ? (
        <div className={`${styles.overviewSections} ${feedStyles.posts}`}>
          {me.posts.map((post) =>
            editing === post.id ? (
              <FeedComposer
                key={post.id}
                author={me.author!}
                courses={me.courses}
                taggable={me.taggable}
                draft={draftOf(post)}
                onDone={replace}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <FeedPostCard
                key={`${post.id}:${post.status}`}
                post={post}
                signedIn
                signInHref={signInHref}
                headingLevel={2}
                aside={
                  <>
                    <div className={feedStyles.postTop}>
                      <span className={feedStyles.state} data-state={post.status}>
                        {STATE_WORDS[post.status]}
                      </span>
                      <div className={feedStyles.postTools}>
                        {post.status === "returned" ? (
                          <button
                            className={feedStyles.commentAction}
                            type="button"
                            onClick={() => setEditing(post.id)}
                          >
                            Виправити й надіслати
                          </button>
                        ) : null}
                        <button className={feedStyles.commentAction} type="button" onClick={() => void remove(post)}>
                          Видалити
                        </button>
                      </div>
                    </div>
                    {post.status === "held" && post.heldReason ? (
                      <p className={feedStyles.reason}>
                        <strong>Автоперевірка зупинила допис:</strong> {post.heldReason}. Команда вирішить і відповість
                        тут.
                      </p>
                    ) : null}
                    {post.status === "returned" ? (
                      <p className={feedStyles.reason}>
                        <strong>Команда повернула:</strong>{" "}
                        {post.returnedReason ? `«${post.returnedReason}»` : "причину ще пишуть."} Виправте — допис
                        пройде перевірку ще раз.
                      </p>
                    ) : null}
                  </>
                }
                footer={post.status === "published" ? <PostEcho post={post} /> : null}
              />
            ),
          )}
        </div>
      ) : null}
    </BuilderShell>
  );
}

/**
 * How a post landed, under its action row (mockup «Мої дописи», 16.10): every
 * reaction by name with its count, the comments, and the newest one someone
 * else left with the way back to the thread. Views, clicks to the programme
 * and payments from a post are not counted anywhere yet, so they are not here.
 */
function PostEcho({ post }: { post: FeedPost }) {
  // The thread lives on the platform host; the workshop is on the personal one.
  const surfaceHref = useSurfaceHref();
  const named = post.reactions.slice(0, ECHO_NAMED);
  const more = post.reactions.length - named.length;
  if (named.length === 0 && post.commentCount === 0) return null;
  return (
    <div className={feedStyles.echo}>
      {named.length ? (
        <p className={feedStyles.echoLine}>
          {named.map((entry) => `${emojiName(entry.emoji)} ${entry.count}`).join(" · ")}
          {more > 0 ? ` ${feedCopy.reactionKindsMore(more)}` : null}
        </p>
      ) : null}
      {post.commentCount > 0 ? (
        <p className={feedStyles.echoLine}>{feedCopy.commentsCount(post.commentCount)}</p>
      ) : null}
      {post.latestComment ? (
        <p className={feedStyles.echoComment}>
          {feedCopy.latestComment(post.latestComment.name)} «{excerptOf(post.latestComment.body, 140)}»{" "}
          <a className={feedStyles.echoReply} href={surfaceHref(feedPostPath(post.id))}>
            {feedCopy.replyInFeed}
          </a>
        </p>
      ) : null}
    </div>
  );
}
