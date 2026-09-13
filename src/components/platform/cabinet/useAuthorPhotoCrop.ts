"use client";

/**
 * Which photograph frame the crop editor is aiming, and where that frame reads
 * and writes in the draft.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13; nothing
 * inside the logic changed.
 */

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  AUTHOR_AVATAR_CROP_DEFAULT,
  AUTHOR_BANNER_CROP_DEFAULT,
  AUTHOR_CARD_CROP_DEFAULT,
} from "@/lib/lms/authorPhoto";
import { CROP_SCALE_MIN } from "@/lib/media/imageCrop";
import type { PhotoCropShape } from "./AuthorProfileMedia";
import type { Draft } from "./authorProfileDraft";
import type { AuthorProfileStrings } from "./authorProfileTypes";

export function useAuthorPhotoCrop(draft: Draft, setDraft: Dispatch<SetStateAction<Draft>>, t: AuthorProfileStrings) {
  /* WHICH FRAME IS BEING AIMED, and in what shape. The shape is snapshotted off
     the frame that opened the editor — its computed `aspect-ratio` and
     `border-radius` — so the window laid over the whole photograph is literally
     the frame the page will draw, and no ratio is retyped in TypeScript. */
  const [cropping, setCropping] = useState<{ shape: PhotoCropShape; ratio: string; radius: string } | null>(null);
  const openCrop = (shape: PhotoCropShape) => (frame: HTMLElement) => {
    const box = getComputedStyle(frame);
    setCropping({ shape, ratio: box.aspectRatio, radius: box.borderRadius });
  };
  const closeCrop = () => setCropping(null);

  /* THE ONE FRAME UNDER THE EDITOR, resolved from the draft: where it reads,
     where it writes, what to call it, and what "centre it again" means for that
     particular shape. Written out here rather than inside the dialog, because
     the dialog has no business knowing that a card and a round avatar keep two
     focal points on one photograph while the band keeps its own picture. */
  const cropTarget = (() => {
    if (!cropping) return null;
    const patchPhoto = (patch: Partial<NonNullable<Draft["photo"]>>) =>
      setDraft((prev) => (prev.photo ? { ...prev, photo: { ...prev.photo, ...patch } } : prev));
    const patchBackground = (patch: Partial<NonNullable<Draft["background"]>>) =>
      setDraft((prev) => (prev.background ? { ...prev, background: { ...prev.background, ...patch } } : prev));

    if (cropping.shape === "banner") {
      const background = draft.background;
      if (!background?.src) return null;
      return {
        ...cropping,
        src: background.src,
        title: t.background,
        note: t.backgroundHint,
        x: background.cropX ?? AUTHOR_BANNER_CROP_DEFAULT.x,
        y: background.cropY ?? AUTHOR_BANNER_CROP_DEFAULT.y,
        scale: background.cropScale ?? CROP_SCALE_MIN,
        onChange: (x: number, y: number) => patchBackground({ cropX: x, cropY: y }),
        onScaleChange: (scale: number) => patchBackground({ cropScale: scale }),
        onReset: () =>
          patchBackground({
            cropX: AUTHOR_BANNER_CROP_DEFAULT.x,
            cropY: AUTHOR_BANNER_CROP_DEFAULT.y,
            cropScale: CROP_SCALE_MIN,
          }),
      };
    }

    const photo = draft.photo;
    if (!photo?.src) return null;
    if (cropping.shape === "avatar") {
      return {
        ...cropping,
        src: photo.src,
        title: t.photoCropAvatarTitle,
        note: t.photoCropAvatarNote,
        x: photo.avatarCropX ?? AUTHOR_AVATAR_CROP_DEFAULT.x,
        y: photo.avatarCropY ?? AUTHOR_AVATAR_CROP_DEFAULT.y,
        scale: photo.avatarCropScale ?? CROP_SCALE_MIN,
        onChange: (x: number, y: number) => patchPhoto({ avatarCropX: x, avatarCropY: y }),
        onScaleChange: (scale: number) => patchPhoto({ avatarCropScale: scale }),
        onReset: () =>
          patchPhoto({
            avatarCropX: AUTHOR_AVATAR_CROP_DEFAULT.x,
            avatarCropY: AUTHOR_AVATAR_CROP_DEFAULT.y,
            avatarCropScale: CROP_SCALE_MIN,
          }),
      };
    }
    return {
      ...cropping,
      src: photo.src,
      title: t.photoCropCardTitle,
      note: t.photoCropCardNote,
      x: photo.cropX ?? AUTHOR_CARD_CROP_DEFAULT.x,
      y: photo.cropY ?? AUTHOR_CARD_CROP_DEFAULT.y,
      scale: photo.cropScale ?? CROP_SCALE_MIN,
      onChange: (x: number, y: number) => patchPhoto({ cropX: x, cropY: y }),
      onScaleChange: (scale: number) => patchPhoto({ cropScale: scale }),
      onReset: () =>
        patchPhoto({
          cropX: AUTHOR_CARD_CROP_DEFAULT.x,
          cropY: AUTHOR_CARD_CROP_DEFAULT.y,
          cropScale: CROP_SCALE_MIN,
        }),
    };
  })();

  return { openCrop, closeCrop, cropTarget };
}
