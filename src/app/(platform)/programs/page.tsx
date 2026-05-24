import type { Metadata } from "next";
import { PlatformProgramsIndexPage } from "@/components/platform/PlatformCatalogPages";

export const metadata: Metadata = {
  title: "Програми CenterWay",
  description:
    "Усі програми CenterWay в одному маршруті: міні-курси, довші практики відновлення, рухові та детокс-формати.",
  alternates: { canonical: "/programs" },
};

export default function ProgramsIndexPage() {
  return <PlatformProgramsIndexPage />;
}
