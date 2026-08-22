import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { LessonView } from "@/components/lms/LessonView";
import { getLiveCourse } from "@/lib/lms/liveCatalog";
import { findLesson } from "@/lms-core";

export const metadata: Metadata = {
  title: "Урок - CenterWay",
  description: "Крок курсу на платформі CenterWay.",
  robots: { index: false, follow: false },
};

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
