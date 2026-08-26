export type LessonPagerLayout = {
  showPrevious: boolean;
  showNext: boolean;
  mode: "hidden" | "single" | "split";
};

/**
 * Keeps the lesson footer honest: it only renders destinations that exist.
 * Reference pages sit outside the learning sequence and therefore never get a
 * previous/next pager, even if a malformed payload were to contain neighbours.
 */
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
