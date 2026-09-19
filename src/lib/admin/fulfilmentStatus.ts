/**
 * The steps of a purchase a person carries out — shared by the server module
 * (`fulfilment.ts`) and the orders page. Kept apart from the server module so the
 * client bundle does not pull the admin database client in with a list of words.
 */
export const FULFILMENT_STATUSES = ["pending", "scheduled", "done", "cancelled"] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export function isFulfilmentStatus(value: unknown): value is FulfilmentStatus {
  return typeof value === "string" && (FULFILMENT_STATUSES as readonly string[]).includes(value);
}
