"use client";

/**
 * The author-profile editor, folded into the cabinet.
 *
 * WHAT THIS WRITES. `lms_authors` — the same row `getCourseAuthor` reads for
 * every course's byline and `getAuthor`/`listListedAuthors` read for the
 * public `/expert/[slug]` page and the `/experts` directory. There is no
 * second copy of a bio anywhere: this is the one place it is written, so a
 * change here is a change everywhere the name appears.
 *
 * WHY IT DOES NOT LIVE IN THE BUILDER. `BuilderCourseSettings` already keeps
 * `authorNote` — the one sentence that changes per course — deliberately
 * apart from the person's bio and photo, which do not. Adding a second editor
 * for the same fields there would mean two forms writing one row, agreeing
 * only until one of them changes shape.
 *
 * WHAT STAYS HERE. The draft, the save, the fold's own open state and the
 * one crop dialog — everything more than one section reads. The sections
 * themselves (`AuthorSection*.tsx`), the upload path (`useAuthorUpload`) and
 * the crop target (`useAuthorPhotoCrop`) were split out on 2026-09-13 with
 * their markup and logic unchanged.
 */

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import type { Author } from "@/lms-core";
import type { ProfileLang } from "@/components/platform/profile/types";
import type { AuthorProfileInput } from "./useCabinet";
import styles from "./Cabinet.module.css";
import { matte } from "./CourseCard";
import type { PhotoCropShape } from "./AuthorProfileMedia";
import { authorFromDraft, draftFromAuthor, type Draft } from "./authorProfileDraft";
import { STRINGS } from "./authorProfileStrings";
import { useAuthorPhotoCrop } from "./useAuthorPhotoCrop";
import { useAuthorUpload } from "./useAuthorUpload";
import { AuthorSectionYou } from "./AuthorSectionYou";
import { AuthorSectionAbout } from "./AuthorSectionAbout";
import { AuthorSectionPage } from "./AuthorSectionPage";
import { AuthorSectionConsultation } from "./AuthorSectionConsultation";

const CropEditor = dynamic(() => import("@/components/media/CropEditor").then((m) => m.CropEditor), { ssr: false });

export const PHOTO_CROP_FRAME: Record<
  PhotoCropShape,
  { className: "photoCropCard" | "photoCropAvatar" | "photoCropBanner" }
> = {
  card: { className: "photoCropCard" },
  avatar: { className: "photoCropAvatar" },
  /* The backdrop band on the author's own page — a 6:1 letterbox, which is why
     it needs aiming more than either of the other two: a portrait handed to it
     loses about five sixths of its height to `cover`. */
  banner: { className: "photoCropBanner" },
};

export function AuthorProfileFold({
  session,
  author,
  saving,
  save,
  lang,
}: {
  session: Session;
  author: Author | null;
  saving: boolean;
  save: (input: AuthorProfileInput) => Promise<boolean>;
  lang: ProfileLang;
}) {
  const t = STRINGS[lang];
  const cropPosition = (x: number, y: number) =>
    t.cropFocusAt.replace("{x}", String(Math.round(x))).replace("{y}", String(Math.round(y)));
  const [draft, setDraft] = useState<Draft>(() => draftFromAuthor(author));
  const { openCrop, closeCrop, cropTarget } = useAuthorPhotoCrop(draft, setDraft, t);
  const toast = useToast();
  const { uploading, uploadError, uploadTarget, upload } = useAuthorUpload(session, t);
  const [open, setOpen] = useState(false);

  // Re-syncs only when the SAVED row changes underneath — not on every render,
  // which would erase whatever the author is mid-typing.
  useEffect(() => {
    setDraft(draftFromAuthor(author));
  }, [author]);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#author") setOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  async function handlePhoto(file: File) {
    const src = await upload("photo", file);
    if (!src) return;
    /* A NEW PICTURE, THE SAME AIM — as for the backdrop below. An author
       swapping one portrait for another has not said anything about where the
       card should look; the recentre button beside each frame is one click
       away when they have. */
    setDraft((prev) => ({
      ...prev,
      photo: {
        ...prev.photo,
        src,
        alt: prev.photo?.alt ?? prev.name,
      },
    }));
  }

  async function handleBackground(file: File) {
    const src = await upload("background", file);
    if (!src) return;
    setDraft((prev) => ({
      ...prev,
      background: { ...prev.background, src },
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    /* One normalisation — see `authorFromDraft`. */
    const next = authorFromDraft(draft, author);

    const ok = await save({
      name: next.name,
      role: next.role,
      bio: next.bio,
      quote: next.quote,
      credentials: next.credentials,
      facts: next.facts,
      profileBlocks: next.profileBlocks,
      experienceBadge: next.experienceBadge,
      achievementBadge: next.achievementBadge,
      consultation: next.consultation,
      photo: next.photo,
      background: next.background,
      listed: next.listed,
      slug: next.slug || undefined,
    });
    if (ok) toast.success(t.saved);
    else toast.error(t.error);
  }

  return (
    <details id="author" className={styles.fold} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.foldHead}>
        <div className={styles.foldText}>
          {/* No eyebrow: `label` and `title` were the same string, byte for
              byte, in both languages — the heading was being announced by a
              smaller copy of itself. */}
          <h2 className={styles.sectionTitle}>{t.title}</h2>
          <span className={styles.sectionLead}>{t.lead}</span>
        </div>
        <Icon className={styles.foldChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.foldBody}>
        <form
          className={styles.authorForm}
          {...matte}
          onSubmit={handleSubmit}
          /* A REQUIRED FIELD INSIDE A CLOSED SECTION IS NOT FOCUSABLE, and a
             browser that cannot focus the control it wants to complain about
             gives up silently: no message, no submit, a dead «Зберегти».
             `invalid` bubbles and fires before that focus attempt, so opening
             every `details` above the offending control here is what keeps the
             sections collapsible at all. */
          onInvalid={(event) => {
            let node = (event.target as HTMLElement).parentElement;
            while (node) {
              if (node instanceof HTMLDetailsElement) node.open = true;
              node = node.parentElement;
            }
          }}
        >
          {/* GROUPED BY WHAT THE AUTHOR IS EDITING, not by which surface
              renders it. The first split was by consumer — byline / card /
              page / offer — which is true of the data and wrong for the
              hand: it put the background two sections away from the photo,
              the credentials away from the facts, and cut one page into a
              "publish it" band and a "fill it" band. Where a field actually
              prints is said in the field's own hint, which is where someone
              filling it in is already looking. */}
          <AuthorSectionYou
            draft={draft}
            setDraft={setDraft}
            t={t}
            uploading={uploading}
            uploadError={uploadError}
            uploadTarget={uploadTarget}
            openCrop={openCrop}
            onPhoto={handlePhoto}
            onBackground={handleBackground}
          />
          <AuthorSectionAbout draft={draft} setDraft={setDraft} t={t} />
          <AuthorSectionPage draft={draft} setDraft={setDraft} t={t} />
          <AuthorSectionConsultation draft={draft} setDraft={setDraft} t={t} />

          <div className={styles.actions}>
            <button className={styles.actionPrimary} type="submit" disabled={saving || uploading}>
              {saving ? t.saving : uploading ? t.photoUploading : t.save}
            </button>
            {author?.listed && author.slug ? (
              <Link
                className={styles.actionGhost}
                href={`/expert/${author.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{t.viewPublic}</span>
                <Icon name="arrow-right" size={18} />
              </Link>
            ) : null}
          </div>
        </form>
      </div>
      {/* OUTSIDE THE FORM'S FIELDS, INSIDE ITS STATE. One editor serves all three
          frames: which shape it wears, where it reads and where it writes are
          the only differences between them, and three copies of a dialog is how
          two of them fall behind the third. It edits the DRAFT, like every other
          control here — nothing is written until the author saves. */}
      {cropTarget ? (
        <CropEditor
          src={cropTarget.src}
          alt=""
          title={cropTarget.title}
          note={cropTarget.note}
          ratio={cropTarget.ratio}
          radius={cropTarget.radius}
          x={cropTarget.x}
          y={cropTarget.y}
          scale={cropTarget.scale}
          onChange={cropTarget.onChange}
          onScaleChange={cropTarget.onScaleChange}
          onReset={cropTarget.onReset}
          onClose={closeCrop}
          labels={{
            stage: t.cropFocus,
            zoom: t.cropZoom,
            reset: t.photoCropCenter,
            done: t.cropDone,
            position: (x, y) => cropPosition(x, y),
          }}
        />
      ) : null}
    </details>
  );
}
