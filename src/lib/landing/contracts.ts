export type UtilityPage = "thanks" | "pay-failed" | "public-offer";

export const LANDING_STATIC_BRANDS = new Set(["short", "reboot", "irem", "consult", "detox", "herbs", "cw", "shared"]);

export const UTILITY_FILE_BY_PAGE: Record<UtilityPage, string> = {
  thanks: "thanks.html",
  "pay-failed": "pay-failed.html",
  "public-offer": "public-offer.html",
};

export const UTILITY_PAGE_BY_FILE: Record<string, UtilityPage> = Object.fromEntries(
  Object.entries(UTILITY_FILE_BY_PAGE).map(([page, file]) => [file, page as UtilityPage])
) as Record<string, UtilityPage>;

export function getUtilityPageByFile(fileName: string): UtilityPage | null {
  return UTILITY_PAGE_BY_FILE[fileName] ?? null;
}

export function getUtilityPageFromAssetPath(assetPath: string[]): UtilityPage | null {
  if (assetPath.length !== 1) {
    return null;
  }
  return getUtilityPageByFile(assetPath[0]);
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
