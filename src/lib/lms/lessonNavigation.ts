export type LessonPagerLayout = {
  showPrevious: boolean;
  showNext: boolean;
  mode: "hidden" | "single" | "split";
};

/** Keeps the lesson footer honest by rendering only destinations that exist. */
export function lessonPagerLayout({
  isReference,
  hasPrevious,
  hasNext,
}: {
  isReference: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
}): LessonPagerLayout {
  const showPrevious = !isReference && hasPrevious;
  const showNext = !isReference && hasNext;

  return {
    showPrevious,
    showNext,
    mode: showPrevious && showNext ? "split" : showPrevious || showNext ? "single" : "hidden",
  };
}
