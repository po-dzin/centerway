/* Split out of DoshaTestClient on 2026-09-13; since 2026-09-30 the screen itself
   is `DiagnosticIntro`, shared with every other test, and this file is the
   dosha test's copy for it. Stateless — the state and the start flow live in
   useDoshaAttempt. */

import { DiagnosticIntro } from "@/components/platform/DiagnosticIntro";
import { BOUNDARY_NOTE, DOSHA_DISCLOSURE, HOW_IT_WORKS_STEPS } from "@/lib/dosha/doshaResultCopy";
import { platformPageArtwork } from "@/lib/platform/content";
import type { Author } from "@/lms-core";

type DoshaIntroProps = {
  /* WHOSE TEST THIS IS. A test carries a byline for the same reason a
     programme does: its vocabulary — doshas, elements, constitution — is one
     practitioner's language, and it is answerable when a person stands behind
     it. Null prints nothing: an unclaimed test must not borrow a face. */
  author: Author | null;
  fontFamily: string;
  topbarBadge: string;
  error: string | null;
  isBusy: boolean;
  requestStartTest: () => Promise<void>;
};

export function DoshaIntro({ author, fontFamily, topbarBadge, error, isBusy, requestStartTest }: DoshaIntroProps) {
  return (
    <DiagnosticIntro
      artwork={platformPageArtwork.doshaTest}
      imageAlt="Доша-тест CenterWay: три доші — три матеріали"
      phaseAttribute="data-dosha-phase"
      fontFamily={fontFamily}
      badge={topbarBadge}
      title="Тест доші"
      lead="Швидка самооцінка тіла, енергії, емоцій і мислення — щоб побачити поточний стан і зрозуміти, з чого почати."
      author={author}
      steps={HOW_IT_WORKS_STEPS}
      notes={[DOSHA_DISCLOSURE]}
      boundary={BOUNDARY_NOTE}
      error={error}
      isBusy={isBusy}
      onStart={() => {
        void requestStartTest();
      }}
    />
  );
}
