/**
 * The editable draft of an author profile, and the two mappings between it and the Author record.
 *
 * Split out of AuthorProfileFold.tsx (1,573 lines) on 2026-09-11; nothing inside any declaration changed.
 */

import type { Author, AuthorProfileBlock } from "@/lms-core";
import { CROP_SCALE_MIN } from "@/lib/media/imageCrop";

export type Draft = {
  name: string;
  role: string;
  bio: string;
  quote: string;
  credentials: string[];
  facts: string[];
  profileBlocks: AuthorProfileBlock[];
  experienceBadge: string;
  consultation: { enabled: boolean; title: string; summary: string; points: string[]; contactUrl: string };
  photo: NonNullable<Author["photo"]> | null;
  background: NonNullable<Author["background"]> | null;
  listed: boolean;
  slug: string;
};

export function draftFromAuthor(author: Author | null): Draft {
  return {
    name: author?.name ?? "",
    role: author?.role ?? "",
    bio: author?.bio ?? "",
    quote: author?.quote ?? "",
    // A blank starting row rather than an empty list — see `AuthorMediaSlot`'s
    // note on the same instinct: a list with nothing to click but "+" reads as
    // broken, not as "add your first one".
    /* ONE FIELD, NOT TWO. «Головне досягнення» was a separate input that the
       card printed as a badge while this list printed underneath it — two
       places to say the same kind of thing, and the badge was the one that
       blocked publishing. The list's first row is the badge now. An existing
       profile filled both, so the stored badge is seeded as row one: without
       that, the first save after this change would overwrite it with whatever
       happened to be first in the list. */
    credentials: (() => {
      const stored = author?.credentials ?? [];
      const badge = author?.achievementBadge?.trim();
      const rest = stored.filter((line) => line.trim() !== badge);
      const rows = badge ? [badge, ...rest] : stored;
      return rows.length ? rows : [""];
    })(),
    facts: author?.facts?.length ? author.facts : [""],
    profileBlocks: author?.profileBlocks ?? [],
    experienceBadge: author?.experienceBadge ?? "",
    consultation: {
      enabled: author?.consultation?.enabled ?? false,
      title: author?.consultation?.title ?? "",
      summary: author?.consultation?.summary ?? "",
      points: author?.consultation?.points?.length ? author.consultation.points : [""],
      contactUrl: author?.consultation?.contactUrl ?? "",
    },
    /* THE DRAFT OPENS ON WHAT IS STORED, AND SEEDS NOTHING. A zoom was briefly
       seeded here so both axes had room to drag; it meant opening the cabinet
       and pressing save re-cropped every photograph already published by 15% of
       its edge. The editor shows the whole picture now, so a flush axis is
       visible rather than felt as a dead gesture, and this stays a copy. */
    photo: author?.photo ? { ...author.photo } : null,
    background: author?.background
      ? { ...author.background }
      : null,
    listed: author?.listed ?? false,
    slug: author?.slug ?? "",
  };
}

/**
 * THE DRAFT AS AN `Author` — one normalisation, in one place.
 *
 * WHY IT IS ONE FUNCTION. The trimming, the slicing and the "row one of the
 * credentials is the badge" rule used to live inside `handleSubmit`, which then
 * listed the fields of its payload by hand — and a hand-written list is how
 * both crop scales came to be edited, drawn on screen and then silently dropped
 * on save (2026-09-06). The draft becomes the platform's own `Author` here, so
 * a field that exists on the type reaches the row without anyone remembering to
 * add a line.
 *
 * `base` carries the identifiers a draft has no opinion about — the row's id
 * and the slug the server assigned.
 */
export function authorFromDraft(draft: Draft, base: Author | null): Author {
  const credentialLines = draft.credentials.map((line) => line.trim()).filter(Boolean);
  /* Row one is the badge, the remainder is the list — sending row one in both
     would print the same sentence twice on `/expert`, once in the hero badge
     row and once in the starred list under it. */
  const [achievementBadge, ...credentials] = credentialLines;
  const alt = draft.photo?.alt.trim();
  const photo = draft.photo?.src && alt
    ? {
        src: draft.photo.src,
        alt,
        ...(draft.photo.cropX !== undefined ? { cropX: draft.photo.cropX } : {}),
        ...(draft.photo.cropY !== undefined ? { cropY: draft.photo.cropY } : {}),
        ...(draft.photo.avatarCropX !== undefined ? { avatarCropX: draft.photo.avatarCropX } : {}),
        ...(draft.photo.avatarCropY !== undefined ? { avatarCropY: draft.photo.avatarCropY } : {}),
        /* `> CROP_SCALE_MIN`, not `!== undefined` — absent means "no zoom"
           everywhere else in the crop model (src/lib/media/imageCrop.ts), and
           writing a literal 1 would freeze today's default into the row. */
        ...(draft.photo.cropScale !== undefined && draft.photo.cropScale > CROP_SCALE_MIN
          ? { cropScale: draft.photo.cropScale }
          : {}),
        ...(draft.photo.avatarCropScale !== undefined && draft.photo.avatarCropScale > CROP_SCALE_MIN
          ? { avatarCropScale: draft.photo.avatarCropScale }
          : {}),
      }
    : undefined;

  const background = draft.background?.src
    ? {
        src: draft.background.src,
        ...(draft.background.cropX !== undefined ? { cropX: draft.background.cropX } : {}),
        ...(draft.background.cropY !== undefined ? { cropY: draft.background.cropY } : {}),
        ...(draft.background.cropScale !== undefined && draft.background.cropScale > CROP_SCALE_MIN
          ? { cropScale: draft.background.cropScale }
          : {}),
      }
    : undefined;

  return {
    id: base?.id ?? "draft",
    slug: draft.slug.trim() || base?.slug || "",
    name: draft.name.trim(),
    ...(draft.role.trim() ? { role: draft.role.trim() } : {}),
    ...(draft.bio.trim() ? { bio: draft.bio.trim() } : {}),
    ...(draft.quote.trim() ? { quote: draft.quote.trim() } : {}),
    ...(credentials.length > 0 ? { credentials } : {}),
    facts: draft.facts.map((line) => line.trim()).filter(Boolean).slice(0, 6),
    /* A block with a title and nothing under it is not a block — the page
       would draw a heading over an empty panel. */
    profileBlocks: draft.profileBlocks.flatMap((block) => {
      const title = block.title.trim();
      const body = block.body?.trim();
      const items = block.items?.map((line) => line.trim()).filter(Boolean).slice(0, 30);
      if (!title || (!body && !items?.length)) return [];
      return [{
        id: block.id,
        kind: block.kind,
        ...(block.label?.trim() ? { label: block.label.trim() } : {}),
        title,
        ...(body ? { body } : {}),
        ...(items?.length ? { items } : {}),
      }];
    }),
    ...(draft.experienceBadge.trim() ? { experienceBadge: draft.experienceBadge.trim() } : {}),
    ...(achievementBadge ? { achievementBadge } : {}),
    consultation: {
      enabled: draft.consultation.enabled,
      ...(draft.consultation.title.trim() ? { title: draft.consultation.title.trim() } : {}),
      ...(draft.consultation.summary.trim() ? { summary: draft.consultation.summary.trim() } : {}),
      points: draft.consultation.points.map((line) => line.trim()).filter(Boolean).slice(0, 3),
      ...(draft.consultation.contactUrl.trim() ? { contactUrl: draft.consultation.contactUrl.trim() } : {}),
    },
    ...(photo ? { photo } : {}),
    /* NORMALISED THE SAME WAY THE PHOTO IS, and it was not: this passed the
       draft object through raw, so the band wrote `cropScale: 1` into the row —
       the literal default the photo branch above exists to keep out. One frame
       storing "no zoom" as absence and the other as 1 is two answers to one
       question, and the reader of the row cannot tell which means what. */
    ...(background ? { background } : {}),
    listed: draft.listed,
  };
}
