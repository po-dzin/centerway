import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "IREM Гімнастика: відновлююча рухова система",
  description: describe(
    "Щоденна рухова практика IREM: мобільність, робота з м'язовими затискачами, контакт із тілом і рівна енергія протягом дня."
  ),
  path: "/programs/irem",
});

export default function IremPage() {
  return <ProgramDetailPage program={programPageBySlug.irem} />;
}
