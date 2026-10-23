/**
 * WHO THE ACCOUNT SAYS IT IS — one name and one face per person (G 2026-10-22).
 *
 * An author used to carry two of each: Google's («Gleb P.», the Google photo)
 * on the account, and their own on the author profile («Центр П.», the photo
 * they cropped). Comments, the account menu and the emails read the first, the
 * author's page the second. Now saving the profile writes its name and photo
 * onto the account, and every reader here asks for the account's chosen ones
 * first.
 *
 * OUR OWN KEYS, NOT GOOGLE'S. Supabase merges the provider's claims
 * (`full_name`, `name`, `avatar_url`, `picture`) back into `user_metadata` on
 * every Google sign-in, so a profile name written there would last until the
 * next login. `cw_name` / `cw_avatar` / `cw_avatar_crop` are keys Google never
 * sends, so they survive it, and Google's own stay as the fallback for everyone
 * who has no profile. The database trigger that mirrors the account into
 * `platform_users` reads them in the same order (migration 20261022160000).
 */

import type { CSSProperties } from "react";

import { cropStyle, type ImageCrop } from "@/lib/media/imageCrop";
import { AUTHOR_AVATAR_CROP_DEFAULT, authorAvatarCrop } from "@/lib/lms/authorPhoto";
import type { Author } from "@/lms-core";

type Meta = Record<string, unknown> | null | undefined;

function text(meta: Meta, key: string): string | null {
  const value = meta?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** The account's name: the one its owner chose, else the provider's. */
export function accountName(meta: Meta): string | null {
  return text(meta, "cw_name") ?? text(meta, "full_name") ?? text(meta, "name");
}

/** The account's photo: the one its owner chose, else the provider's. */
export function accountAvatar(meta: Meta): string | null {
  return text(meta, "cw_avatar") ?? text(meta, "avatar_url") ?? text(meta, "picture");
}

/**
 * THE PROVIDER'S PHOTO AT A SIZE FIT FOR A SCREEN (G 2026-10-23: «превью
 * пиксельное»). Google hands out its account photo as `…=s96-c`, a 96px
 * square, which is right for a 40px circle and a smear in the full-screen
 * viewer. The size is a suffix Google reads, so the viewer asks for a larger
 * one; every other address (our own storage, another provider) is returned
 * untouched.
 */
export function accountAvatarLarge(src: string): string {
  if (!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//i.test(src)) return src;
  return src.replace(/=s\d+(-c)?$/, "=s1024-c");
}

/** How the chosen photo sits in a circle. A provider's photo is a centred square already. */
export function accountAvatarCrop(meta: Meta): ImageCrop | undefined {
  if (!text(meta, "cw_avatar")) return undefined;
  const crop = meta?.cw_avatar_crop;
  if (!crop || typeof crop !== "object") return undefined;
  const { x, y, scale } = crop as Record<string, unknown>;
  return {
    ...(typeof x === "number" ? { x } : {}),
    ...(typeof y === "number" ? { y } : {}),
    ...(typeof scale === "number" ? { scale } : {}),
  };
}

/** The style an account avatar's `<img>` carries. */
export function accountAvatarStyle(crop: ImageCrop | undefined): CSSProperties | undefined {
  return crop ? cropStyle(crop, AUTHOR_AVATAR_CROP_DEFAULT) : undefined;
}

/**
 * The metadata a saved author profile puts on its account. A profile without a
 * photo clears the chosen one (null deletes the key), so the provider's face
 * comes back rather than a photo the author has since removed.
 */
export function accountMetaFromAuthor(author: Pick<Author, "name" | "photo">): Record<string, unknown> {
  const crop = author.photo ? authorAvatarCrop(author.photo) : null;
  const cleanCrop = crop ? Object.fromEntries(Object.entries(crop).filter(([, value]) => value !== undefined)) : null;
  return {
    cw_name: author.name.trim() || null,
    cw_avatar: author.photo?.src ?? null,
    cw_avatar_crop: cleanCrop && Object.keys(cleanCrop).length ? cleanCrop : null,
  };
}

/**
 * The metadata a face uploaded from the profile hero puts on an account that
 * has no author profile (2026-10-23). The crop is cleared: it described the
 * previous picture, and a fresh one is shown centred until its owner aims it.
 * An author's upload does not come here — it goes into the profile, and
 * `accountMetaFromAuthor` writes the account from that.
 */
export function accountMetaFromUpload(src: string): Record<string, unknown> {
  return { cw_avatar: src, cw_avatar_crop: null };
}
