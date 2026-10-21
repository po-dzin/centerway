"use client";

/**
 * The loudness of a recording in `FEED_AUDIO_PEAKS` steps, 0–100, measured from
 * the file in the author's browser before it is posted — the shape the
 * player draws (G 2026-10-21). Null when the browser cannot decode it; the
 * post goes out without a shape and the player draws a quiet line.
 */

import { FEED_AUDIO_PEAKS } from "@/lib/feed/media";

export async function audioPeaks(file: Blob): Promise<number[] | null> {
  const Context =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const context = new Context();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / FEED_AUDIO_PEAKS));
    const raw: number[] = [];
    for (let index = 0; index < FEED_AUDIO_PEAKS; index += 1) {
      let sum = 0;
      const start = index * step;
      const end = Math.min(data.length, start + step);
      for (let at = start; at < end; at += 1) {
        const sample = data[at] ?? 0;
        sum += sample * sample;
      }
      raw.push(Math.sqrt(sum / Math.max(1, end - start)));
    }
    const loudest = Math.max(...raw);
    if (!(loudest > 0)) return null;
    return raw.map((value) => Math.round((value / loudest) * 100));
  } catch {
    return null;
  } finally {
    void context.close();
  }
}
