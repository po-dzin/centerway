/**
 * What a failed face upload says, by the status the avatar route answered
 * (2026-10-23). The same four sentences the author fold's photo fields print,
 * read from the same strings, so the two doors cannot word one failure twice.
 */

import { STRINGS } from "./authorProfileStrings";
import type { ProfileLang } from "../profile/types";

export const ACCOUNT_AVATAR_ROUTE = "/api/platform/users/me/avatar";

export function faceUploadError(status: number, lang: ProfileLang): string {
  const t = STRINGS[lang];
  if (status === 413) return t.uploadTooLarge;
  if (status === 415) return t.uploadBadType;
  if (status === 429) return t.uploadTooOften;
  return t.uploadFailed;
}
