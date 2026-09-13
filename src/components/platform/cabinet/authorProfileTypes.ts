/**
 * The props every section of the author-profile editor shares.
 *
 * Split out of AuthorProfileFold.tsx (1,163 lines) on 2026-09-13. The draft
 * itself stays owned by the fold — every section writes into the one draft,
 * and nothing is saved until the fold's form submits — so a section receives
 * the draft and its setter rather than keeping a copy of its own.
 */

import type { Dispatch, SetStateAction } from "react";
import type { ProfileLang } from "@/components/platform/profile/types";
import type { Draft } from "./authorProfileDraft";
import type { STRINGS } from "./authorProfileStrings";

export type AuthorProfileStrings = (typeof STRINGS)[ProfileLang];

export type AuthorUploadTarget = "photo" | "background";

export type AuthorSectionProps = {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  t: AuthorProfileStrings;
};
