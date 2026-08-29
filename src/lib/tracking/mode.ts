// Single switch for the "no admin ingestion" test: pixel + CAPI keep firing normally,
// but nothing derived from Meta (ads insights sync) or about low-value local events
// reaches our DB/admin, and lead notifications stop going to the support Telegram group.
// Real business records (leads in DB, orders, Purchase CAPI) are unaffected.
export function isMetaTestModeEnabled(): boolean {
  const raw = (process.env.CW_META_TEST_MODE ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}
