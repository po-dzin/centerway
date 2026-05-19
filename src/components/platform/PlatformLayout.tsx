"use client";

import type { ReactNode } from "react";
import styles from "./PlatformShellStyles";
import { PlatformFooter } from "./layout/PlatformFooter";
import { PlatformHeader } from "./layout/PlatformHeader";

export function PlatformShell({
  children,
  headerMode = "default",
}: {
  children: ReactNode;
  headerMode?: "default" | "overlay";
}) {
  return (
    <div className={`${styles.shell} ${headerMode === "overlay" ? styles.shellOverlay : ""}`}>
      <PlatformHeader />
      {children}
      <PlatformFooter />
    </div>
  );
}
