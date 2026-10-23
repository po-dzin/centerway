"use client";

/**
 * The hero's «Завантажити фото» (2026-10-23): shrink on the device, send to
 * the avatar route, and refresh the session so every surface that reads the
 * token — the topbar first — shows the new face without a sign-in.
 *
 * The route decides where the picture is written (the author profile for an
 * author, the account otherwise); this hook only reports what came back.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { accountAvatar } from "@/lib/auth/accountIdentity";
import { shrinkForUpload } from "@/lib/media/shrinkForUpload";
import { supabaseClient } from "@/lib/supabaseClient";
import type { Author } from "@/lms-core";
import type { ProfileLang } from "../profile/types";
import { ACCOUNT_AVATAR_ROUTE, faceUploadError } from "./faceUpload";

export type FaceUploadResult = { ok: true; src: string; author: Author | null } | { ok: false; error: string };

export function useAccountFace(session: Session | null, lang: ProfileLang, serverAvatar: string | null) {
  const [uploading, setUploading] = useState(false);

  /* ONE FACE IN THE HERO AND IN THE TOPBAR (G 2026-10-23: «в топбаре одно фото,
     а в профиле другое»). The hero shows what the server says the account's
     photo is; the topbar reads the signed-in token, which carries the photo
     it was minted with until it is refreshed. When the two disagree the token
     is the stale one — the photo changed on another tab, in the author fold,
     or in a refresh that failed — so the session is refreshed, once for each
     photo the server names, which cannot loop when the two keep disagreeing
     for another reason. */
  const healed = useRef<string | null>(null);
  const tokenAvatar = accountAvatar(session?.user?.user_metadata);
  const signedIn = Boolean(session?.access_token);
  useEffect(() => {
    if (!signedIn || !serverAvatar || tokenAvatar === serverAvatar || healed.current === serverAvatar) return;
    healed.current = serverAvatar;
    void supabaseClient.auth.refreshSession().catch(() => undefined);
  }, [signedIn, serverAvatar, tokenAvatar]);

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
