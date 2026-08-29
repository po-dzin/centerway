import { BuilderLessonEditor } from "@/components/builder/BuilderLessonEditor";

export default async function BuilderLessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course, lesson } = await params;
  return <BuilderLessonEditor slug={course} lessonSlug={lesson} />;
}
