/** Feed topics extend the catalogue without changing course classification. */
import type { CwIconName } from "@/lib/brand/iconNames";
import { COURSE_CATEGORY_ICONS, COURSE_CATEGORY_LABELS } from "@/lib/platform/catalogVocabulary";
import type { FeedTopic } from "./model";
export const FEED_TOPIC_LABELS: Record<FeedTopic, string> = {
  ...COURSE_CATEGORY_LABELS,
  art: "Арт",
  meaning: "Сенс",
  technology: "Технології",
};
export const FEED_TOPIC_ICONS: Record<FeedTopic, CwIconName> = {
  ...COURSE_CATEGORY_ICONS,
  art: "photo",
  meaning: "guide",
  technology: "settings",
};
