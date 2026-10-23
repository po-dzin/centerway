"use client";

/**
 * A post's audio, in the platform's own player (G 2026-10-21) instead of the
 * browser's grey one: a gold «слухати», whose voice it is and how long, the
 * waveform drawn as brush strokes in the icons' hand (`hand2`), gold where it
 * has played, and the speed.
 *
 * - The waveform is the recording's own loudness (`peaks`, measured when it was
 *   posted). Audio posted before that has no shape, and the player draws a quiet
 *   line rather than an invented one.
 * - The strokes are the seek bar: a tap or a drag moves the playhead; arrows
 *   step 5 s, Home and End go to the ends.
 * - One sound at a time: starting one pauses any other in the feed.
 * - On the lock screen and in the system controls the post speaks for itself
 *   (`useFeedMediaSession`): its opening line, «Автор · CenterWay», its photo or
 *   the author's face, and ±10 s.
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Icon } from "@/components/Icon";
import type { FeedAudio as Audio } from "@/lib/feed/media";

import { feedCopy } from "./copy";
import { claimFeedPlayback, useFeedMediaSession, type FeedMediaAbout } from "./mediaSession";
import styles from "./Feed.module.css";

const SPEEDS = [1, 1.5, 2] as const;
const STEP_SEC = 5;

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A small, stable wobble per stroke, so the strokes look drawn, not stamped. */
function wobble(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * One stroke per peak: a tapered brush mark, thin at its top, full in the
 * middle, drawn to a point, leaning slightly — in a 280×32 box.
 */
function strokes(peaks: number[]): string[] {
  const step = 280 / peaks.length;
  return peaks.map((peak, index) => {
    const height = 4 + (Math.max(6, peak) / 100) * 24 * (0.92 + wobble(index) * 0.16);
    const cx = step * index + step / 2;
    const top = 16 - height / 2;
    const bottom = 16 + height / 2;
    const width = Math.min(step * 0.62, 3.2);
    const lean = (wobble(index + 7) - 0.5) * 1.4;
    const t = (cx + lean).toFixed(1);
    const b = (cx - lean).toFixed(1);
    return [
      `M${t} ${top.toFixed(1)}`,
      `C${(cx + width).toFixed(1)} ${(top + height * 0.18).toFixed(1)} ${(cx + width * 0.8).toFixed(1)} ${(bottom - height * 0.22).toFixed(1)} ${b} ${bottom.toFixed(1)}`,
      `C${(cx - width * 0.9).toFixed(1)} ${(bottom - height * 0.3).toFixed(1)} ${(cx - width * 0.7).toFixed(1)} ${(top + height * 0.12).toFixed(1)} ${t} ${top.toFixed(1)}Z`,
    ].join(" ");
  });
}

export function FeedAudio({ audio, about }: { audio: Audio; about: FeedMediaAbout }) {
  const player = useRef<HTMLAudioElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const filter = `feed-hand-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [duration, setDuration] = useState(audio.durationSec);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  useFeedMediaSession(player, about, playing);

  const toggle = useCallback(() => {
    const element = player.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }, []);

  useEffect(() => {
    const element = player.current;
    if (element) element.playbackRate = speed;
  }, [speed]);

  const seekTo = useCallback(
    (seconds: number) => {
      const element = player.current;
      if (!element || !duration) return;
      element.currentTime = Math.min(duration, Math.max(0, seconds));
      setAt(element.currentTime);
    },
    [duration],
  );

  function seekFromPointer(event: PointerEvent<HTMLDivElement>) {
    const box = bar.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    seekTo(((event.clientX - box.left) / box.width) * duration);
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowRight: at + STEP_SEC,
      ArrowUp: at + STEP_SEC,
      ArrowLeft: at - STEP_SEC,
      ArrowDown: at - STEP_SEC,
      Home: 0,
      End: duration,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    seekTo(moves[event.key] ?? at);
  }

  const share = duration > 0 ? at / duration : 0;
  const peaks = audio.peaks;
  const marks = peaks ? strokes(peaks) : null;
  const played = peaks ? Math.round(share * peaks.length) : 0;

  return (
    <figure className={styles.audio} data-no-open="">
      <button
        className={styles.audioPlay}
        type="button"
        aria-label={playing ? feedCopy.audioPause : feedCopy.audioPlay}
        onClick={toggle}
      >
        <Icon name={playing ? "pause" : "play"} size={22} />
      </button>
      <div className={styles.audioBody}>
        <figcaption className={styles.audioHead}>
          <span className={styles.audioTitle}>{feedCopy.audioBy(about.author, clock(duration))}</span>
          <button
            className={styles.audioSpeed}
            type="button"
            aria-label={feedCopy.audioSpeed(speed)}
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)}
          >
            {`${String(speed).replace(".", ",")}×`}
          </button>
        </figcaption>
        <div
          ref={bar}
          className={styles.audioWave}
          role="slider"
          tabIndex={0}
          aria-label={feedCopy.audioSeek}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(at)}
          aria-valuetext={`${clock(at)} / ${clock(duration)}`}
          onKeyDown={onKey}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFromPointer(event);
          }}
        >
          <svg viewBox="0 0 280 32" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id={filter} filterUnits="userSpaceOnUse" x="-4" y="0" width="288" height="32">
                <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            {marks ? (
              <g filter={`url(#${filter})`}>
                {marks.map((d, index) => (
                  <path key={index} d={d} className={index < played ? styles.audioOn : undefined} />
                ))}
              </g>
            ) : (
              <g filter={`url(#${filter})`} className={styles.audioLine}>
                <path d="M2 16 H278" />
                <path d={`M2 16 H${(2 + share * 276).toFixed(1)}`} className={styles.audioOn} />
              </g>
            )}
          </svg>
        </div>
        <div className={styles.audioTime} aria-hidden="true">
          <span>{clock(at)}</span>
          <span>{clock(duration)}</span>
        </div>
      </div>
      <audio
        ref={player}
        preload="metadata"
        onPlay={(event) => {
          claimFeedPlayback(event.currentTarget);
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setAt(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const seconds = event.currentTarget.duration;
          if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds);
        }}
      >
        <source src={audio.src} type={audio.mime} />
      </audio>
    </figure>
  );
}
