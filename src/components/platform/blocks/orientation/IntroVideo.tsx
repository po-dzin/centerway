"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformHeroStyles";

/* THE PLAYER'S OWN POSTER IS NOT OURS TO SHAPE (2026-08-29).
   An idle YouTube iframe draws its own cover: the channel avatar, the video's
   full title across the top and a «Watch on YouTube» pill across the bottom.
   That chrome is laid out for a wide player and does not reflow — inside the
   322px frame this card gives it on a phone, the title was cut off mid-word at
   the right edge and the pill ran past it. Nothing on our side of the iframe
   can reach it; the only fix is not to render it.

   So the idle state is ours: the video's own still, our play mark, and the
   card's 16:9 frame exactly filled. The iframe is created on the first press,
   with `autoplay` so the press still starts the video. Same contract as before
   — one 16:9 frame in the panel — and the visitor's browser no longer talks to
   YouTube at all until they ask it to. */
const VIDEO_ID = "6jmhNMj_Duo";
const POSTER = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
const TITLE = "Вступне відео CenterWay";

export function HubIntroVideo() {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={styles.videoFrame}>
        <iframe
          className={styles.videoEmbed}
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0&modestbranding=1&autoplay=1`}
          title={TITLE}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={styles.videoFrame}>
      <button
        type="button"
        className={styles.videoPoster}
        onClick={() => setPlaying(true)}
        aria-label={`Дивитися: ${TITLE}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a remote still
            served by YouTube for this video id; there is no local rendition and
            next/image would proxy a third-party host for no gain. */}
        <img
          className={styles.videoPosterImage}
          src={POSTER}
          alt=""
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
        />
        <span className={styles.videoPlayMark} aria-hidden="true">
          <Icon name="play" size={26} />
        </span>
      </button>
    </div>
  );
}
