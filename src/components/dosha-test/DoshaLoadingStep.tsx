/* Split out of DoshaTestClient on 2026-09-13. Owns the loading phase: the
   wait while the server classifies the answers.

   THE PLATFORM'S ONE WAITING CARD (2026-10-03). This used to be its own
   layout inside the flow panel — the step chip, then the mark on a row of its
   own, then a display heading and a lead — a panel's height of mostly empty
   card for one sentence. It is `PlatformLoadingState` now, rendered in place
   of the panel rather than inside it: the mark and the sentence on one row,
   the same card every other wait on the platform shows. */

import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";

export function DoshaLoadingStep() {
  return (
    <PlatformLoadingState
      title="Аналізуємо ваш профіль..."
      detail="Формуємо практичний вектор і наступний крок у платформі."
    />
  );
}
