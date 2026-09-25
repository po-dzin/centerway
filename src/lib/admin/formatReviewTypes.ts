/**
 * The owner's review list, as the admin screen sees it.
 *
 * Apart from `lib/experiences/formatAuthoring` for the same reason the other
 * `*Types.ts` files are apart from their modules: that one imports the
 * service-role client, and the screen is a client component.
 */
export type FormatReviewRow = {
  code: string;
  format: "self" | "group" | "individual";
  label: string;
  summary: string;
  mode: "checkout" | "lead";
  amount: number | null;
  proposedAmount: number | null;
  currency: string;
  cohortStartsOn: string | null;
  reviewStatus: "draft" | "proposed" | "approved" | "declined";
  active: boolean;
  includes: Array<{ slug: string; title: string }>;
  courseSlug: string;
  courseTitle: string;
};
