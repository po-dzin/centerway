import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CourseView } from "@/components/lms/CourseView";
import { getCourse } from "@/lib/lms/catalog";

export const metadata: Metadata = {
  title: "Мій курс - CenterWay",
  description: "Проходження курсу на платформі CenterWay: маршрут, кроки і прогрес.",
  // Learner surfaces are private — they must never reach an index.
  robots: { index: false, follow: false },
};

export default async function LearnCoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;

  // Existence is public information; entitlement is decided by the API.
  if (!getCourse(course)) notFound();

  return (
    <PlatformShell headerMode="overlay">
      <CourseView courseSlug={course} />
    </PlatformShell>
  );
}
