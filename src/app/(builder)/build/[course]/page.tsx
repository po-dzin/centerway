import { BuilderCourseView } from "@/components/builder/BuilderCourseView";

export default async function BuilderCoursePage({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const { course } = await params;
  return <BuilderCourseView slug={course} />;
}
