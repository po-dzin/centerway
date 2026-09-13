"use client";

/**
 * The one upload path both photograph fields go through, and its state.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13; nothing
 * inside the logic changed. The state is read by the fold as well as by the
 * photo section — the save button waits on `uploading` — so the fold calls
 * this hook and hands the result down.
 */

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { shrinkForUpload } from "@/lib/media/shrinkForUpload";
import type { AuthorProfileStrings, AuthorUploadTarget } from "./authorProfileTypes";

export function useAuthorUpload(session: Session, t: AuthorProfileStrings) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<AuthorUploadTarget | null>(null);

  /* The two upload fields were the same fifteen lines twice, and they had
     already drifted once. The shape of a failure belongs to the endpoint, not
     to the field calling it. */
  function uploadErrorFor(status: number): string {
    if (status === 413) return t.uploadTooLarge;
    if (status === 415) return t.uploadBadType;
    if (status === 429) return t.uploadTooOften;
    return t.uploadFailed;
  }

  async function upload(target: AuthorUploadTarget, file: File): Promise<string | null> {
    setUploading(true);
    setUploadError(null);
    setUploadTarget(target);
    try {
      /* Before the bytes leave the device — see shrinkForUpload. This is why
         the same replacement that used to sit silent for most of a minute on a
         phone now finishes in a few seconds. */
      const prepared = await shrinkForUpload(file);
      const form = new FormData();
      form.append("file", prepared);
      const res = await fetch(`/api/lms/authors/me/${target}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        setUploadError(uploadErrorFor(res.status));
        return null;
      }
      const body = (await res.json()) as { src: string };
      return body.src;
    } catch {
      setUploadError(t.uploadFailed);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { uploading, uploadError, uploadTarget, upload };
}
