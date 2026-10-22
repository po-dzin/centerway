"use client";

/**
 * The home page's rail of full post cards, in the platform's own carousel
 * (`PlatformOfferCarousel`): three abreast on a wide screen, one on a phone,
 * with its dots under it and room for the cards' shadows.
 *
 * The server sends the guest's view. Once the session is known the three
 * posts are read again with the reader's token, so their own reactions and
 * saves show as pressed — the same re-seed the feed does.
 */

import { useEffect, useState } from "react";

import { useSignInHref } from "@/components/auth/useSignInReturn";
import { useSession } from "@/components/auth/SessionProvider";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import type { FeedPost } from "@/lib/feed/server";

import { fetchFeedPost } from "./feedApi";
import { FeedPostCard } from "./FeedPostCard";

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
    <PlatformOfferCarousel label="Свіже від авторів">
      {posts.map((post) => (
        <FeedPostCard
          key={`${post.id}:${round}`}
          post={post}
          signedIn={Boolean(session?.user)}
          signInHref={signInHref}
          headingLevel={3}
          variant="rail"
        />
      ))}
    </PlatformOfferCarousel>
  );
}
