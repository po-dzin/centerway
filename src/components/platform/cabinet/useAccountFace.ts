"use client";

/**
 * The hero's «Завантажити фото» (2026-10-23): shrink on the device, send to
 * the avatar route, and refresh the session so every surface that reads the
 * token — the topbar first — shows the new face without a sign-in.
 *
 * The route decides where the picture is written (the author profile for an
 * author, the account otherwise); this hook only reports what came back.
 */

import { useCallback, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { shrinkForUpload } from "@/lib/media/shrinkForUpload";
import { supabaseClient } from "@/lib/supabaseClient";
import type { Author } from "@/lms-core";
import type { ProfileLang } from "../profile/types";
import { ACCOUNT_AVATAR_ROUTE, faceUploadError } from "./faceUpload";

export type FaceUploadResult = { ok: true; src: string; author: Author | null } | { ok: false; error: string };

export function useAccountFace(session: Session | null, lang: ProfileLang) {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File): Promise<FaceUploadResult> => {
      if (!session?.access_token) return { ok: false, error: faceUploadError(401, lang) };
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", await shrinkForUpload(file));
        const res = await fetch(ACCOUNT_AVATAR_ROUTE, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: form,
        });
        if (!res.ok) return { ok: false, error: faceUploadError(res.status, lang) };
        const body = (await res.json()) as { src: string; author: Author | null };
        /* The account's metadata changed on the server; a fresh token carries
           it, and the account menu reads the token. */
        await supabaseClient.auth.refreshSession().catch(() => undefined);
        return { ok: true, src: body.src, author: body.author };
      } catch {
        return { ok: false, error: faceUploadError(0, lang) };
      } finally {
        setUploading(false);
      }
    },
    [session, lang],
  );

  return { uploading, upload };
}
