"use client";

import { useEffect } from "react";

export function useRevealOnIntersect(selector = ".reveal") {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(selector);
    if (!targets.length) return;

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((node) => {
        node.classList.add("is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.1,
      }
    );

    targets.forEach((target) => {
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, [selector]);
}
