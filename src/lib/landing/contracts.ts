export type UtilityPage = "thanks" | "pay-failed" | "public-offer";
export type ManagedLandingPage = UtilityPage | "index2";

export const LANDING_STATIC_BRANDS = new Set(["short", "reboot", "irem", "way21", "reset-day", "dosha", "consult", "herbs", "shared"]);

export const UTILITY_FILE_BY_PAGE: Record<UtilityPage, string> = {
  thanks: "thanks.html",
  "pay-failed": "pay-failed.html",
  "public-offer": "public-offer.html",
};

export const MANAGED_LANDING_FILE_BY_PAGE: Record<ManagedLandingPage, string> = {
  index2: "index2.html",
  ...UTILITY_FILE_BY_PAGE,
};

export const UTILITY_PAGE_BY_FILE: Record<string, UtilityPage> = Object.fromEntries(
  Object.entries(UTILITY_FILE_BY_PAGE).map(([page, file]) => [file, page as UtilityPage])
) as Record<string, UtilityPage>;

export const MANAGED_LANDING_PAGE_BY_FILE: Record<string, ManagedLandingPage> = Object.fromEntries(
  Object.entries(MANAGED_LANDING_FILE_BY_PAGE).map(([page, file]) => [file, page as ManagedLandingPage])
) as Record<string, ManagedLandingPage>;

export function getUtilityPageByFile(fileName: string): UtilityPage | null {
  return UTILITY_PAGE_BY_FILE[fileName] ?? null;
}

export function getManagedLandingPageByFile(fileName: string): ManagedLandingPage | null {
  return MANAGED_LANDING_PAGE_BY_FILE[fileName] ?? null;
}

export function getUtilityPageFromAssetPath(assetPath: string[]): UtilityPage | null {
  if (assetPath.length !== 1) {
    return null;
  }
  const [segment] = assetPath;
  if (segment in UTILITY_FILE_BY_PAGE) {
    return segment as UtilityPage;
  }
  return getUtilityPageByFile(segment);
}

export function getManagedLandingPageFromAssetPath(assetPath: string[]): ManagedLandingPage | null {
  if (assetPath.length !== 1) {
    return null;
  }
  const [segment] = assetPath;
  if (segment in MANAGED_LANDING_FILE_BY_PAGE) {
    return segment as ManagedLandingPage;
  }
  return getManagedLandingPageByFile(segment);
}

export const ROOT_LANDING_PAGE_MAP: Record<string, string> = {
  "/": "/index.html",
  "/index.html": "/index.html",
  "/index2.html": "/index2.html",
  "/public-offer.html": "/public-offer.html",
  "/thanks": "/thanks.html",
  "/thanks.html": "/thanks.html",
  "/pay-failed": "/pay-failed.html",
  "/pay-failed.html": "/pay-failed.html",
};

export const LANDING_ASSET_PREFIXES = ["/css/", "/js/", "/img/", "/fonts/", "/libs/"];
export const LANDING_ROOT_FILES = new Set(["/main-short.css", "/media-short.css", "/Frame"]);
