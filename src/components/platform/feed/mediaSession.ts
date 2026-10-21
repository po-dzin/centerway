"use client";

/**
 * What a playing post tells the phone (G 2026-10-21). Without it the lock
 * screen and the system controls show only the tab's title, «Стрічка —
 * CenterWay», and the app icon; with it they show the post's opening line,
 * «Автор · CenterWay», the post's photo or the author's face, and ±10 s.
 *
 * Also the feed's one-sound-at-a-time rule: a sound or clip that starts pauses
 * whichever was playing.
 */

import { useEffect, type RefObject } from "react";

export type FeedMediaAbout = {
  /** The post's opening line, as the author wrote it. */
  title: string;
  author: string;
  /** The platform's own post: its name is already the brand. */
  platform: boolean;
  /** The post's photo, else the author's face; the brand icon when neither. */
  artwork: string | null;
};

const SKIP_SEC = 10;
const BRAND_ARTWORK = "/cw/brand/cw-icon-512.png";

let current: HTMLMediaElement | null = null;

/** Call when `element` starts: whatever else in the feed was playing stops. */
export function claimFeedPlayback(element: HTMLMediaElement) {
  if (current && current !== element && !current.paused) current.pause();
  current = element;
}

export function useFeedMediaSession(
  player: RefObject<HTMLMediaElement | null>,
  about: FeedMediaAbout,
  playing: boolean,
) {
  const { title, author, platform, artwork } = about;
  useEffect(() => {
    const element = player.current;
    if (!playing || !element || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    const session = navigator.mediaSession;
    const art = new URL(artwork ?? BRAND_ARTWORK, window.location.origin).toString();
    session.metadata = new MediaMetadata({
      title,
      artist: platform ? "CenterWay · Стрічка" : `${author} · CenterWay`,
      album: "Стрічка",
      artwork: [{ src: art, sizes: "512x512" }],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void element.play()],
      ["pause", () => element.pause()],
      ["seekbackward", () => (element.currentTime = Math.max(0, element.currentTime - SKIP_SEC))],
      [
        "seekforward",
        () => (element.currentTime = Math.min(element.duration || Infinity, element.currentTime + SKIP_SEC)),
      ],
      [
        "seekto",
        (details) => {
          if (typeof details.seekTime === "number") element.currentTime = details.seekTime;
        },
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* An action this browser does not offer. */
      }
    }
  }, [player, playing, title, author, platform, artwork]);
}
