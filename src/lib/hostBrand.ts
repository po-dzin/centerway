import type { ProductKey } from "@/lib/surfaces/catalog";
import { getProductByHost } from "@/lib/surfaces/catalog";

export type HostBrand = ProductKey;

export function hostBrandFromHost(rawHost: string | null): HostBrand | null {
  return getProductByHost(rawHost);
}
