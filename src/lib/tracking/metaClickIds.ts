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

export function extractFbclidFromFbc(value: unknown): string | null {
  const fbc = normalizeFbc(value);
  if (!fbc) return null;
  const parts = fbc.split(".");
  if (parts.length < 4) return null;
  const embeddedFbclid = parts.slice(3).join(".").trim();
  return embeddedFbclid.length > 0 ? embeddedFbclid : null;
}

export function resolveFbc(input: {
  fbc?: unknown;
  fbclid?: unknown;
  creationTimeSeconds?: number | null;
}): string | null {
  const directFbc = normalizeFbc(input.fbc);
  const fbclid = normalizeFbclid(input.fbclid);
  if (directFbc) {
    if (!fbclid) return directFbc;
    const embeddedFbclid = extractFbclidFromFbc(directFbc);
    if (!embeddedFbclid || embeddedFbclid === fbclid) {
      return directFbc;
    }
  }

  if (!fbclid) return null;

  const creationTimeSeconds =
    typeof input.creationTimeSeconds === "number" && Number.isFinite(input.creationTimeSeconds)
      ? input.creationTimeSeconds
      : null;
  if (creationTimeSeconds === null) return null;

  return buildFbcFromFbclid(fbclid, creationTimeSeconds);
}
