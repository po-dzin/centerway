export type HostBrand = "short" | "irem";

const IREM_HOST_PREFIXES = ["irem.", "www.irem."];
const SHORT_HOST_PREFIXES = ["reboot.", "www.reboot."];

function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  return raw.split(":")[0].trim().toLowerCase();
}

function isLocalDevHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1";
}

export function hostBrandFromHost(rawHost: string | null): HostBrand | null {
  const host = normalizeHost(rawHost);

  for (const prefix of IREM_HOST_PREFIXES) {
    if (host.startsWith(prefix)) return "irem";
  }
  for (const prefix of SHORT_HOST_PREFIXES) {
    if (host.startsWith(prefix)) return "short";
  }

  // Local/dev fallback.
  if (isLocalDevHost(host)) return "short";

  return null;
}
