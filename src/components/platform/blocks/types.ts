import type { programPageBySlug } from "@/lib/platform/content";

export type PlatformProgramSlug = keyof typeof programPageBySlug;

export type PlatformRouteBlockProps = {
  route: string;
  programSlug?: PlatformProgramSlug;
};
