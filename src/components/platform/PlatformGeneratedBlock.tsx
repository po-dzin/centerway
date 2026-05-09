import { platformBlockRegistry } from "@/components/platform/blocks/registry";
import type { PlatformGeneratedBlockProps } from "@/components/platform/blocks/types";

export function PlatformGeneratedBlock(props: PlatformGeneratedBlockProps) {
  const Component = platformBlockRegistry[props.variant];
  return Component ? <Component {...props} /> : null;
}
