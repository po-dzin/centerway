import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CourseView } from "@/components/lms/CourseView";
import { ZenPreviewShell } from "@/components/lms/ZenPreviewShell";
import { getLiveCourse } from "@/lib/lms/liveCatalog";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Мій курс",
  description: describe("Проходження курсу на платформі CenterWay: кроки і прогрес.", { bounded: false }),
  // Learner surfaces are private — they must never reach an index.
  noindex: true,
});

export default async function LearnCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ course: string }>;
  searchParams: Promise<{ preview?: string; returnTo?: string }>;
}) {
  const { course } = await params;
  const search = await searchParams;
  const draftPreview = search.preview === "draft";
  const fallbackReturnTo = `/build/${encodeURIComponent(course)}`;
  const previewReturnTo = search.returnTo?.startsWith("/build/") && !search.returnTo.startsWith("//")
    ? search.returnTo
    : fallbackReturnTo;

  // Existence is public information; entitlement is decided by the API.
  // Draft preview existence is private and is therefore resolved only by the
  // Bearer-authenticated API in the client below.
  if (!draftPreview && !(await getLiveCourse(course))) notFound();

  const view = <CourseView courseSlug={course} draftPreview={draftPreview} previewReturnTo={previewReturnTo} />;

  return draftPreview
    ? <ZenPreviewShell returnTo={previewReturnTo}>{view}</ZenPreviewShell>
    : <PlatformShell headerMode="learn">{view}</PlatformShell>;
}
