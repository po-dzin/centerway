import { programPageBySlug } from "@/lib/platform/content";
import type { PlatformProgramSlug } from "@/components/platform/blocks/types";

export const routeLabels: Record<string, string> = {
  "platform-home": "CenterWay",
  expert: "Євгеній Корякін",
  "program-way21": "Шлях 21",
  "program-natural-body": "Природнє тіло",
  /* ІВЕМ, not IREM: the landing has spelled the brand in Cyrillic since it
     shipped (see `src/landing-static/irem/index.html`) and only the platform
     side kept the Latin form, so one product wore two names depending on
     which door the reader came through. The slug stays `irem` — that is an
     address and a payment code, not a name. */
  "program-irem": "ІВЕМ-гімнастика",
  "program-reboot": "Short-Перезавантаження",
  "reset-day": "Розвантажувальний день",
};

export function currentProgram(programSlug?: PlatformProgramSlug) {
  if (!programSlug) return null;
  return programPageBySlug[programSlug] ?? null;
}
