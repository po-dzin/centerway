/** Human labels for account roles that are meaningful in a personal profile. */
const ROLE_LABELS: Record<string, string> = {
  admin: "Адміністратор",
  support: "Підтримка",
  coach: "Куратор",
};

/** A plain learner needs no redundant "Користувач" tag. */
export function platformRoleLabel(role: string | null): string | null {
  return role ? (ROLE_LABELS[role] ?? null) : null;
}
