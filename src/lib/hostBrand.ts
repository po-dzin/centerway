export type HostBrand = "short" | "irem" | "consult" | "detox" | "herbs";

const IREM_HOST_PREFIXES = ["irem.", "www.irem."];
const SHORT_HOST_PREFIXES = ["reboot.", "www.reboot."];
const CONSULT_HOST_PREFIXES = ["consult.", "www.consult."];
const DETOX_HOST_PREFIXES = ["detox.", "www.detox."];
const HERBS_HOST_PREFIXES = ["herbs.", "www.herbs."];

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
  for (const prefix of CONSULT_HOST_PREFIXES) {
    if (host.startsWith(prefix)) return "consult";
  }
  for (const prefix of DETOX_HOST_PREFIXES) {
    if (host.startsWith(prefix)) return "detox";
  }
  for (const prefix of HERBS_HOST_PREFIXES) {
    if (host.startsWith(prefix)) return "herbs";
  }

  // Local/dev fallback.
  if (isLocalDevHost(host)) return "short";

  return null;
}
