import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { LessonView } from "@/components/lms/LessonView";
import { ReaderTrail } from "@/components/lms/ReaderTrail";
import { ZenPreviewShell } from "@/components/lms/ZenPreviewShell";
import { getLiveCourse } from "@/lib/lms/liveCatalog";
import { findLesson } from "@/lms-core";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Урок",
  description: describe("Крок курсу на платформі CenterWay.", { bounded: false }),
  noindex: true,
});

export default async function LearnLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ course: string; lesson: string }>;
  searchParams: Promise<{ preview?: string; returnTo?: string }>;
}) {
  const { course, lesson } = await params;
  const search = await searchParams;
  const draftPreview = search.preview === "draft";
  const fallbackReturnTo = `/build/${encodeURIComponent(course)}/${encodeURIComponent(lesson)}`;
  const previewReturnTo = search.returnTo?.startsWith("/build/") && !search.returnTo.startsWith("//")
    ? search.returnTo
    : fallbackReturnTo;

  /* The titles the trail needs come from the SAME read that answers 404, so
     putting the breadcrumb in the bar costs no extra query. It is built here
     rather than inside LessonView because the bar is rendered above the view:
     the server has the names, so the crumb ships with the document instead of
     appearing once the client fetch lands. */
  let trail: { courseTitle: string; lessonTitle: string } | null = null;

  // 404 only for content that does not exist. Whether this learner may READ it
  // is decided by /api/lms/*, which owns entitlement and drip.
  if (!draftPreview) {
    const found = await getLiveCourse(course);
    const step = found ? findLesson(found, lesson) : null;
    if (!found || !step) notFound();
    trail = { courseTitle: found.title, lessonTitle: step.lesson.title };
  }

  const view = (
    <LessonView
      courseSlug={course}
      lessonSlug={lesson}
      draftPreview={draftPreview}
      previewReturnTo={previewReturnTo}
    />
  );

  return draftPreview
    ? <ZenPreviewShell returnTo={previewReturnTo}>{view}</ZenPreviewShell>
    : (
      <PlatformShell
        headerMode="learn"
        footer={false}
        headerContent={
          trail ? (
            <ReaderTrail courseSlug={course} courseTitle={trail.courseTitle} lessonTitle={trail.lessonTitle} />
          ) : null
        }
      >
        {view}
      </PlatformShell>
    );
}
