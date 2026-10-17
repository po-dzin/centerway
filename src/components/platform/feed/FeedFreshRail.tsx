"use client";

/**
 * The home page's rail of full post cards. Three abreast on a wide screen; on
 * a phone a sideways rail of 86vw cards that snap, so the next card always
 * shows at the edge and says «there is more».
 *
 * The server sends the guest's view. Once the session is known the three
 * posts are read again with the reader's token, so their own reactions and
 * saves show as pressed — the same re-seed the feed does.
 */

import { useEffect, useState } from "react";

import { useSignInHref } from "@/components/auth/useSignInReturn";
import { useSession } from "@/components/auth/SessionProvider";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import type { FeedPost } from "@/lib/feed/server";

import { fetchFeedPost } from "./feedApi";
import { FeedPostCard } from "./FeedPostCard";
import styles from "./Feed.module.css";

export function FeedFreshRail({ posts: initial }: { posts: FeedPost[] }) {
  const { session, status } = useSession();
  const surfaceHref = useSurfaceHref();
  const signInHref = useSignInHref(surfaceHref("/profile"));
  const [posts, setPosts] = useState(initial);
  const [round, setRound] = useState(0);
  const token = session?.access_token ?? null;
  const ids = initial.map((post) => post.id).join(",");

  useEffect(() => {
    if (status !== "signed-in" || !token) return;
    let cancelled = false;
    void Promise.all(ids.split(",").map((id) => fetchFeedPost(id))).then((results) => {
      if (cancelled) return;
      setPosts((current) =>
        current.map((post, index) => {
          const result = results[index];
          return result?.ok ? result.data.post : post;
        }),
      );
      setRound((current) => current + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [status, token, ids]);

  return (
    <ul className={`${styles.fresh} cw-scroll-rail`}>
      {posts.map((post) => (
        <li key={`${post.id}:${round}`}>
          <FeedPostCard
            post={post}
            signedIn={Boolean(session?.user)}
            signInHref={signInHref}
            headingLevel={3}
            variant="rail"
          />
        </li>
      ))}
    </ul>
  );
}
