/**
 * IREM landing enhancements.
 *
 * This is the exact reveal / sticky-CTA / anchor / accordion logic that lives
 * inline in the way21 & reset-day static pages (which are served raw). IREM is
 * served through prepareLandingHtml -> renderEntryHtmlDocument, whose body
 * pass strips inline <script> blocks (SCRIPT_TAG_BLOCK), so the same logic has
 * to be loaded as an external file via config.scripts to reach the static host
 * path (irem.centerway.net.ua). Keep this in sync with the way21 inline script.
 */
(function () {
  if (window.__iremEnhanceInit) return;
  window.__iremEnhanceInit = true;

  function init() {
    (function () {
      const sticky = document.getElementById("stickyCta");
      const anchors = document.querySelectorAll("[data-cta-hero],[data-cta-final]");
      if (sticky && anchors.length) {
        const visible = new Set();
        const ctaIo = new IntersectionObserver(
          (es) => {
            es.forEach((e) => {
              e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
            });
            sticky.classList.toggle("hidden", visible.size > 0);
          },
          { threshold: 0 }
        );
        anchors.forEach((a) => ctaIo.observe(a));
      }
    })();

    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el, i) => {
      el.style.transitionDelay = Math.min(i % 4, 3) * 70 + "ms";
      io.observe(el);
    });

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.querySelectorAll(".acc").forEach((group) => {
      group.querySelectorAll("details").forEach((d) => {
        d.addEventListener("toggle", () => {
          if (d.open)
            group.querySelectorAll("details").forEach((o) => {
              if (o !== d) o.open = false;
            });
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
