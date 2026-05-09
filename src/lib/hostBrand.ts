export type HostBrand = "reboot" | "irem" | "consult" | "detox" | "herbs";

const IREM_HOST_PREFIXES = ["irem.", "www.irem."];
const SHORT_HOST_PREFIXES = ["reboot.", "www.reboot."];
const CONSULT_HOST_PREFIXES = ["consult.", "www.consult."];
const DETOX_HOST_PREFIXES = ["detox.", "www.detox."];
const HERBS_HOST_PREFIXES = ["herbs.", "www.herbs."];

function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  return raw.split(":")[0].trim().toLowerCase();
}

export function hostBrandFromHost(rawHost: string | null): HostBrand | null {
  const host = normalizeHost(rawHost);

  for (const prefix of IREM_HOST_PREFIXES) {
    if (host.startsWith(prefix)) return "irem";
  }
  for (const prefix of SHORT_HOST_PREFIXES) {
    if (host.startsWith(prefix)) return "reboot";
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
  return null;
}
