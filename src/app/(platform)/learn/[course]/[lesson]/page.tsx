import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { LessonView } from "@/components/lms/LessonView";
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
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course, lesson } = await params;

  // 404 only for content that does not exist. Whether this learner may READ it
  // is decided by /api/lms/*, which owns entitlement and drip.
  const found = await getLiveCourse(course);
  if (!found || !findLesson(found, lesson)) notFound();

  return (
    <PlatformShell headerMode="learn">
      <LessonView courseSlug={course} lessonSlug={lesson} />
    </PlatformShell>
  );
}
