import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CourseView } from "@/components/lms/CourseView";
import { getLiveCourse } from "@/lib/lms/liveCatalog";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Мій курс",
  description: describe("Проходження курсу на платформі CenterWay: кроки і прогрес.", { bounded: false }),
  // Learner surfaces are private — they must never reach an index.
  noindex: true,
});

export default async function LearnCoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;

  // Existence is public information; entitlement is decided by the API.
  if (!(await getLiveCourse(course))) notFound();

  return (
    <PlatformShell headerMode="learn">
      <CourseView courseSlug={course} />
    </PlatformShell>
  );
}
