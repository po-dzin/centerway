"use client";

/**
 * The live feed: the server's first page, then everything a reader does —
 * the filter in the address, «Показати ще», reactions, comments, marks, and
 * for an author the composer above the posts.
 *
 * The first page arrives rendered for a guest. Once the session is known the
 * page is asked again with the reader's token, so their own reactions show as
 * pressed and their marks are drawn; a guest keeps what the server sent.
 */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSignInHref } from "@/components/auth/useSignInReturn";
import { useSession } from "@/components/auth/SessionProvider";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { feedFilterCount, feedFilterQuery, type FeedFilter as Filter } from "@/lib/feed/model";
import type { FeedAuthor, FeedPage, FeedPost } from "@/lib/feed/server";

import { feedCopy } from "./copy";
import { fetchFeedMe, fetchFeedPage, fetchFeedPost, fetchMarks, type FeedMarkView, type FeedMe } from "./feedApi";
import { FeedComposer } from "./FeedComposer";
import { FeedFilter } from "./FeedFilter";
import { FeedPostCard } from "./FeedPostCard";
import styles from "./Feed.module.css";

export function FeedView({
  initial,
  authors,
  filter: initialFilter,
  mode = "feed",
}: {
  initial: FeedPage;
  authors: FeedAuthor[];
  filter: Filter;
  /** `author`: one author's posts on their own page — no filter, no composer. */
  mode?: "feed" | "author";
}) {
  const pathname = usePathname();
  const { session, status } = useSession();
  const surfaceHref = useSurfaceHref();
  const signInHref = useSignInHref(surfaceHref("/profile"));
  const signedIn = Boolean(session?.user);

  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [page, setPage] = useState<FeedPage>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [me, setMe] = useState<FeedMe | null>(null);
  const [marks, setMarks] = useState<Record<string, FeedMarkView[]>>({});
  const asked = useRef(0);
  /* Each fresh read re-seeds the cards: a card keeps its reactions in its own
     state, and the signed-in read is what marks the reader's own as pressed. */
  const [round, setRound] = useState(0);

  const load = useCallback(async (next: Filter) => {
    const ticket = ++asked.current;
    setLoading(true);
    const result = await fetchFeedPage(next);
    if (ticket !== asked.current) return;
    setLoading(false);
    setFailed(!result.ok);
    if (result.ok) {
      setPage(result.data);
      setRound((current) => current + 1);
    }
  }, []);

  /* The reader's own view once the session is known: pressed reactions, and
     for an author the composer with their programmes. */
  const token = session?.access_token ?? null;
  useEffect(() => {
    if (status !== "signed-in" || !token) return;
    void load(filter);
    if (mode === "feed") {
      void fetchFeedMe().then((result) => {
        if (result.ok) setMe(result.data);
      });
    }
    // Only a change of who is reading re-asks; the filter has its own path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  const postIds = page.posts.map((post) => post.id).join(",");
  useEffect(() => {
    if (!signedIn || !postIds) return;
    void fetchMarks(postIds.split(",")).then((result) => {
      if (!result.ok) return;
      const byPost: Record<string, FeedMarkView[]> = {};
      for (const mark of result.data.marks) (byPost[mark.postId] ??= []).push(mark);
      setMarks(byPost);
    });
  }, [signedIn, postIds]);

  function changeFilter(next: Filter) {
    setFilter(next);
    const query = feedFilterQuery(next);
    /* The address follows the choice without a server round trip: the list is
       already being fetched here, and Next keeps its own state in step with
       `history.replaceState`. */
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    void load(next);
  }

  async function more() {
    if (!page.next || loading) return;
    setLoading(true);
    const result = await fetchFeedPage(filter, { before: page.next });
    setLoading(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setPage((current) => {
      const seen = new Set(current.posts.map((post) => post.id));
      return {
        posts: [...current.posts, ...result.data.posts.filter((post) => !seen.has(post.id))],
        next: result.data.next,
      };
    });
  }

  function published(post: FeedPost) {
    if (post.status !== "published") return;
    setPage((current) => ({ ...current, posts: [post, ...current.posts.filter((entry) => entry.id !== post.id)] }));
  }

  const filtered = feedFilterCount(filter) > 0;

  return (
    <div className={mode === "feed" ? styles.posts : styles.embedded}>
      {mode === "feed" && me?.author ? (
        <FeedComposer author={me.author} courses={me.courses} onDone={published} />
      ) : null}

      {mode === "feed" ? <FeedFilter filter={filter} authors={authors} onChange={changeFilter} /> : null}

      {page.posts.length === 0 && !loading ? (
        <p className={styles.empty}>
          {failed ? feedCopy.loadFailed : filtered ? feedCopy.emptyFiltered : feedCopy.empty}
        </p>
      ) : null}

      <div className={styles.posts} aria-busy={loading || undefined}>
        {page.posts.map((post) => (
          <FeedPostCard
            key={`${post.id}:${round}`}
            post={post}
            signedIn={signedIn}
            signInHref={signInHref}
            marks={marks[post.id] ?? []}
            onMarks={(id, list) => setMarks((current) => ({ ...current, [id]: list }))}
            headingLevel={mode === "feed" ? 2 : 3}
          />
        ))}
      </div>

      {page.next ? (
        <div className={styles.more}>
          <button className={styles.moreButton} type="button" disabled={loading} onClick={() => void more()}>
            {loading ? feedCopy.loading : feedCopy.more}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** One post on its own address, with its thread open. */
export function FeedSingle({ initial }: { initial: FeedPost }) {
  const { session, status } = useSession();
  const surfaceHref = useSurfaceHref();
  const signInHref = useSignInHref(surfaceHref("/profile"));
  const [post, setPost] = useState(initial);
  const [round, setRound] = useState(0);
  const [marks, setMarks] = useState<FeedMarkView[]>([]);
  const token = session?.access_token ?? null;

  useEffect(() => {
    if (status !== "signed-in" || !token) return;
    void fetchFeedPost(initial.id).then((result) => {
      if (!result.ok) return;
      setPost(result.data.post);
      setRound((current) => current + 1);
    });
    void fetchMarks([initial.id]).then((result) => {
      if (result.ok) setMarks(result.data.marks);
    });
  }, [status, token, initial.id]);

  return (
    <FeedPostCard
      key={round}
      post={post}
      signedIn={Boolean(session?.user)}
      signInHref={signInHref}
      marks={marks}
      onMarks={(_, list) => setMarks(list)}
      commentsOpen
    />
  );
}
