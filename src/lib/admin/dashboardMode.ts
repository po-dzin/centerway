/**
 * Which question the analytics dashboard is being asked, and therefore which of
 * its sections exist.
 *
 * The panel was built for a business running on paid traffic: four of its seven
 * tabs are Meta attribution machinery. That contour is valuable and stays. But
 * the product became a school, and somebody opening the page to ask "how are
 * the courses doing" had to read past a CTR to find out. The answer is not
 * fewer tabs — it is two questions, each with its own set.
 *
 * This lives outside the page because it is the part that can actually be
 * wrong: which sections a mode offers, and what happens to the section you were
 * already on when you switch. The admin is behind a Google sign-in, so it
 * cannot be checked by opening it; it can be checked here.
 */

export const DASHBOARD_MODES = ["courses", "traffic"] as const;
export type DashboardMode = (typeof DASHBOARD_MODES)[number];

export const ANALYTICS_SECTIONS = [
  "overview",
  "funnel",
  "products",
  "campaigns",
  "capi",
  "dosha",
  "inputs_quality",
] as const;
export type AnalyticsSection = (typeof ANALYTICS_SECTIONS)[number];

/** `courses` first: it is the question asked daily, so it is the default. */
export const MODE_SECTIONS: Record<DashboardMode, readonly AnalyticsSection[]> = {
  courses: ["overview", "products", "dosha"],
  traffic: ["overview", "funnel", "campaigns", "capi", "inputs_quality"],
};

export const DEFAULT_DASHBOARD_MODE: DashboardMode = "courses";

export function isDashboardMode(value: unknown): value is DashboardMode {
  return typeof value === "string" && (DASHBOARD_MODES as readonly string[]).includes(value);
}

/**
 * The section to show after a mode switch.
 *
 * Keeping the current one when the new mode still offers it is the whole point
 * — switching from Courses to Traffic while reading the overview should leave
 * you on the overview, not throw you somewhere. When it does NOT offer it, the
 * overview is the only safe landing: leaving `analyticsSection` pointing at a
 * tab the strip no longer shows renders a page with a header and nothing under
 * it, which reads as a broken screen rather than as a mode change.
 */
export function sectionForMode(mode: DashboardMode, current: AnalyticsSection): AnalyticsSection {
  return MODE_SECTIONS[mode].includes(current) ? current : "overview";
}
