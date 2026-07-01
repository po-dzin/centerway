"use client";

import { useEffect } from "react";

export function LandingIremEnhancements() {
  useEffect(() => {
    const cleanup: Array<() => void> = [];

    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    revealNodes.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
      el.classList.add("in");
    });

    if (revealNodes.length > 0) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver !== "function") {
        revealNodes.forEach((el) => el.classList.add("in"));
      } else {
        const revealObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("in");
                revealObserver.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
        );

        revealNodes.forEach((el) => revealObserver.observe(el));
        cleanup.push(() => revealObserver.disconnect());
      }
    }

    const sticky = document.getElementById("stickyCta");
    const ctaAnchors = Array.from(document.querySelectorAll<HTMLElement>("[data-cta-hero],[data-cta-final]"));
    if (sticky instanceof HTMLElement && ctaAnchors.length > 0) {
      const visible = new Set<Element>();
      const updateSticky = () => {
        sticky.classList.toggle("hidden", visible.size > 0);
      };

      sticky.classList.add("hidden");
      if (typeof IntersectionObserver === "function") {
        const ctaObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                visible.add(entry.target);
              } else {
                visible.delete(entry.target);
              }
            });
            updateSticky();
          },
          { threshold: 0.01 }
        );

        ctaAnchors.forEach((anchor) => ctaObserver.observe(anchor));
        cleanup.push(() => ctaObserver.disconnect());
      } else {
        const onScroll = () => {
          visible.clear();
          ctaAnchors.forEach((anchor) => {
            const rect = anchor.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
              visible.add(anchor);
            }
          });
          updateSticky();
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        cleanup.push(() => {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        });
      }
    }

    const anchorCleanup = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).map((anchor) => {
      const handler = (event: Event) => {
        const id = anchor.getAttribute("href")?.slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      anchor.addEventListener("click", handler);
      return () => anchor.removeEventListener("click", handler);
    });
    cleanup.push(...anchorCleanup);

    document.querySelectorAll<HTMLElement>(".acc").forEach((group) => {
      group.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
        const handler = () => {
          if (!details.open) return;
          group.querySelectorAll<HTMLDetailsElement>("details").forEach((other) => {
            if (other !== details) other.open = false;
          });
        };
        details.addEventListener("toggle", handler);
        cleanup.push(() => details.removeEventListener("toggle", handler));
      });
    });

    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, []);

  return null;
}
