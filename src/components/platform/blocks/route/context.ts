import { programPageBySlug } from "@/lib/platform/content";
import type { PlatformProgramSlug } from "@/components/platform/blocks/types";

export const routeLabels: Record<string, string> = {
  "platform-home": "CenterWay",
  expert: "Євгеній Корякін",
  "program-way21": "Шлях 21",
  "program-ideal-body": "Ідеальне тіло",
  "program-irem": "IREM Гімнастика",
  "program-reboot": "Short Reboot",
  "reset-day": "Reset Day",
};

export function currentProgram(programSlug?: PlatformProgramSlug) {
  if (!programSlug) return null;
  return programPageBySlug[programSlug] ?? null;
}
