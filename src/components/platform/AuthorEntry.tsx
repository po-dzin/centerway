"use client";

/**
 * The author's way into the builder, from the platform side.
 *
 * Until now the two applications did not know about each other from here. An
 * author who was looking at their own course — as a page, as a learner would
 * see it — had to remember a hostname and type it, and the cabinet did not say
 * the builder existed at all. That is a strange gap for the person who wrote
 * the thing.
 *
 * SILENT IN EVERY UNCERTAIN CASE — while loading, when signed out, when the
 * read fails, and for everyone who may not edit. Same discipline as
 * `OfferAccess`, and for the same reason: these controls appear on public offer
 * pages, and a flicker of an editing control in front of a buyer is worse than
 * a control that never appears.
 *
 * The permission itself is NOT decided here. `/api/platform/authoring` asks
 * `builderAccess`, which is the one place that owns ownership.
 */

import { useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import { BUILDER_PATH_PREFIX } from "@/lib/surfaces/catalog";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "./PlatformOfferCommerce.module.css";

type AuthoringAccess = { isAdmin: boolean; editableCourseSlugs: string[] };

/**
 * Where the builder answers from HERE.
 *
 * One question, one answer: `resolveSurfaceHref` owns which origin a path lives
 * on, including the localhost and preview case where there is no personal host
 * to be on and the prefix is served by path. A second copy of that rule here is
 * how a link comes to be dead in exactly the two places anyone tests it.
 */
export function useBuilderHref(): (path: string) => string {
  const href = useSurfaceHref();
  return (path: string) => href(`${BUILDER_PATH_PREFIX}${path.startsWith("/") ? path : `/${path}`}`);
}

/* One read per tab, shared by every caller. The offer page and the cabinet both
   ask, and without this a reader who opens two courses pays for the same answer
   twice. Same shape as usePlatformRole. */
let cached: Promise<AuthoringAccess> | null = null;

async function readAccess(): Promise<AuthoringAccess> {
  const empty: AuthoringAccess = { isAdmin: false, editableCourseSlugs: [] };
  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return empty;

    const response = await fetch("/api/platform/authoring", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return empty;

    const body = (await response.json()) as Partial<AuthoringAccess>;
    return {
      isAdmin: body.isAdmin === true,
      editableCourseSlugs: Array.isArray(body.editableCourseSlugs) ? body.editableCourseSlugs : [],
    };
  } catch {
    return empty;
  }
}

export function useAuthoringAccess(): AuthoringAccess | null {
  const [access, setAccess] = useState<AuthoringAccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    cached ??= readAccess();
    void cached.then((result) => {
      if (!cancelled) setAccess(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return access;
}

/**
 * "Edit this course" on the offer page that sells it.
 *
 * Takes the COURSE slug, not the programme slug: the builder is addressed by
 * course, and resolving one to the other is the offer page's job — it already
 * has to, to print the outline.
 */
export function CourseAuthorLink({ courseSlug }: { courseSlug: string }) {
  const access = useAuthoringAccess();
  const builderHref = useBuilderHref();
  if (!access || !access.editableCourseSlugs.includes(courseSlug)) return null;

  return (
    <div className={styles.backRow}>
      <a className={styles.backLink} href={builderHref(`/${courseSlug}`)}>
        <Icon name="settings" size={20} />
        <span>Редагувати цей курс у білдері</span>
      </a>
    </div>
  );
}
