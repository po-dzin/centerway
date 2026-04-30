export function normalizeTrackingString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeFbc(value: unknown): string | null {
  return normalizeTrackingString(value);
}

export function normalizeFbclid(value: unknown): string | null {
  return normalizeTrackingString(value);
}

export function buildFbcFromFbclid(fbclid: string, creationTimeSeconds: number): string {
  return `fb.1.${Math.max(0, Math.floor(creationTimeSeconds))}.${fbclid}`;
}

export function resolveFbc(input: {
  fbc?: unknown;
  fbclid?: unknown;
  creationTimeSeconds?: number | null;
}): string | null {
  const directFbc = normalizeFbc(input.fbc);
  if (directFbc) return directFbc;

  const fbclid = normalizeFbclid(input.fbclid);
  if (!fbclid) return null;

  const creationTimeSeconds =
    typeof input.creationTimeSeconds === "number" && Number.isFinite(input.creationTimeSeconds)
      ? input.creationTimeSeconds
      : null;
  if (creationTimeSeconds === null) return null;

  return buildFbcFromFbclid(fbclid, creationTimeSeconds);
}
