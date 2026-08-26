import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { LessonView } from "@/components/lms/LessonView";
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

  // 404 only for content that does not exist. Whether this learner may READ it
  // is decided by /api/lms/*, which owns entitlement and drip.
  if (!draftPreview) {
    const found = await getLiveCourse(course);
    if (!found || !findLesson(found, lesson)) notFound();
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
    : <PlatformShell headerMode="learn" footer={false}>{view}</PlatformShell>;
}
