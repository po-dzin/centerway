/**
 * Deciding what a media sweep may delete.
 *
 * SEPARATED FROM THE SCRIPT THAT DELETES, on purpose. Every other line of
 * `scripts/media-sweep.mjs` is plumbing — an RPC, a bucket call, a printed
 * line — and none of it is where a mistake costs anything. This is: a wrong
 * answer here removes an author's photographs. It is pure, and it is tested.
 *
 * The rules it encodes, and why each one exists, are set out in the ledger
 * migration; the short version:
 *
 *   · referenced means referenced by ANYTHING, version history included, so a
 *     restored revision is never a page of broken frames;
 *   · nothing recent is touched, because an image uploaded and not yet saved is
 *     indistinguishable from an orphan by any query;
 *   · an empty reference set against a full bucket is a broken query, not an
 *     empty product, and it stops the run rather than emptying the bucket.
 */

export type MediaAsset = {
  assetKey: string;
  objects: string[];
  bytes: number;
  /** When the newest object of this asset was written. */
  newest: string;
};

export type SweepPlan = {
  /** Present when the run must not proceed; the text says why. */
  refusal?: string;
  referenced: MediaAsset[];
  /** Unreferenced, but inside the grace period. Left alone. */
  young: MediaAsset[];
  /** Unreferenced and old enough. What --apply would remove. */
  collectable: MediaAsset[];
  totalBytes: number;
  collectableBytes: number;
};

export function planSweep(input: {
  assets: MediaAsset[];
  referenced: Iterable<string>;
  graceDays: number;
  now: number;
}): SweepPlan {
  const keep = new Set(input.referenced);
  const cutoff = input.now - input.graceDays * 24 * 60 * 60 * 1000;

  const referenced: MediaAsset[] = [];
  const young: MediaAsset[] = [];
  const collectable: MediaAsset[] = [];

  for (const asset of input.assets) {
    if (keep.has(asset.assetKey)) {
      referenced.push(asset);
    } else if (!(new Date(asset.newest).getTime() <= cutoff)) {
      // Written as "not old enough" rather than "is recent" so an unparseable
      // date — NaN, and false for every comparison — keeps the file.
      young.push(asset);
    } else {
      collectable.push(asset);
    }
  }

  const total = (list: MediaAsset[]) => list.reduce((sum, asset) => sum + asset.bytes, 0);

  const plan: SweepPlan = {
    referenced,
    young,
    collectable,
    totalBytes: total(input.assets),
    collectableBytes: total(collectable),
  };

  if (input.assets.length > 0 && keep.size === 0) {
    return {
      ...plan,
      collectable: [],
      collectableBytes: 0,
      refusal:
        "no references found at all while the bucket holds objects — refusing to " +
        "read that as 'everything is an orphan'. Check lms_referenced_media().",
    };
  }

  return plan;
}
