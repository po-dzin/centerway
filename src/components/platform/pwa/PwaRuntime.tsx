"use client";

import { useEffect } from "react";
import { isStandaloneDisplay } from "./installStore";

/**
 * Two jobs, both shell-level: register the worker that makes the platform
 * installable, and tell CSS whether we are running inside the installed app.
 *
 * The attribute exists because `@media (display-mode: standalone)` only landed
 * in iOS Safari 16.4, while `navigator.standalone` has carried the same fact
 * for a decade. The bottom bar keys off both, so an older iPhone home-screen
 * launch still gets app chrome instead of a browser page with no way back.
 */
export function PwaRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.dataset.cwStandalone = isStandaloneDisplay() ? "true" : "false";
    };
    sync();

    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", sync);

    if ("serviceWorker" in navigator) {
      // After load: registration competes with the page's own requests
      // otherwise, and the worker is not needed for the first paint.
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          // A failed registration costs installability, not the session.
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    return () => media.removeEventListener("change", sync);
  }, []);

  return null;
}
