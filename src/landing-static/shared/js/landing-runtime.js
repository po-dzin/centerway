(function () {
  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : "";
  }

  function writeCookie(name, value, maxAgeSeconds) {
    var parts = [
      name + "=" + encodeURIComponent(value),
      "path=/",
      "max-age=" + String(maxAgeSeconds),
      "SameSite=Lax"
    ];
    if (window.location.protocol === "https:") {
      parts.push("Secure");
    }
    document.cookie = parts.join("; ");
  }

  function buildFbc(fbclid, nowMs) {
    return "fb.1." + nowMs + "." + fbclid;
  }

  function extractFbclidFromFbc(fbc) {
    if (!fbc) return "";
    var parts = String(fbc).split(".");
    if (parts.length < 4) return "";
    return parts.slice(3).join(".").trim();
  }

  var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "lv", "cr", "fbclid"];
  var qs = new URLSearchParams(window.location.search);
  var attrib = {};
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    var value = qs.get(key);
    if (value) attrib[key] = value;
  }
  if (Object.keys(attrib).length > 0) {
    try {
      localStorage.setItem("cw_attrib", JSON.stringify(attrib));
    } catch (_) {}
  }

  var fbclid = attrib.fbclid;
  if (!fbclid) return;

  var existingFbc = readCookie("_fbc");
  var existingFbclid = extractFbclidFromFbc(existingFbc);
  var shouldReuseExistingFbc = existingFbc && existingFbclid === fbclid;
  var resolvedFbc = shouldReuseExistingFbc ? existingFbc : buildFbc(fbclid, Date.now());

  if (!shouldReuseExistingFbc) {
    try {
      writeCookie("_fbc", resolvedFbc, 60 * 60 * 24 * 90);
    } catch (_) {}
  }

  try {
    var stored = JSON.parse(localStorage.getItem("cw_attrib") || "{}");
    if (!stored.fbc || stored.fbc !== resolvedFbc) {
      stored.fbc = resolvedFbc;
      localStorage.setItem("cw_attrib", JSON.stringify(stored));
    }
  } catch (_) {}
})();

/* Shared burger navigation for the entry landings (short + irem).
   Markup is authored per site in each index.html; this toggles the
   drawer identically for both. Separate IIFE so the attribution
   block's early `return` above never skips it. */
(function () {
  if (typeof document === "undefined") return;

  function init() {
    var nav = document.querySelector("[data-cw-nav]");
    if (!nav || nav.dataset.cwNavReady === "1") return;

    var toggle = nav.querySelector("[data-cw-nav-toggle]");
    var panel = document.querySelector("[data-cw-nav-panel]");
    if (!toggle || !panel) return;

    nav.dataset.cwNavReady = "1";
    var body = document.body;

    // irem's theme sets `body { overflow-x: hidden }`, which makes the body a
    // scroll container and silently breaks `position: sticky` on the header — it
    // scrolled off with the page and never came back on scroll-up. `overflow-x:
    // clip` clips the exact same horizontal overflow without creating a scroll
    // container, so sticky works again. Done here rather than in CSS because on
    // the served entry path the per-site data attribute sits on <main>, out of
    // reach of any <body> selector.
    try {
      if (window.getComputedStyle(body).overflowX === "hidden") {
        body.style.overflowX = "clip";
      }
    } catch (_) {}
    var closers = document.querySelectorAll("[data-cw-nav-close]");

    function isOpen() {
      return body.classList.contains("cw-nav-open");
    }
    function open() {
      body.classList.add("cw-nav-open");
      nav.classList.remove("cw-nav--hidden");
      toggle.setAttribute("aria-expanded", "true");
    }
    function close() {
      body.classList.remove("cw-nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      if (isOpen()) close(); else open();
    });

    for (var i = 0; i < closers.length; i += 1) {
      closers[i].addEventListener("click", close);
    }

    function getY() {
      return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    var lastY = getY();

    // Web fonts (and other late-loading content above the target) can still be
    // swapping in when we jump — that reflows everything above `target` and
    // slides it out from under our landing spot. Re-measure once things settle
    // and correct — but only if the user hasn't scrolled away from where we put
    // them in the meantime.
    function settleScroll(target, askedTop, offset) {
      function reCheck() {
        if (Math.abs(getY() - askedTop) > 40) return;
        var freshTop = target.getBoundingClientRect().top + getY() - offset;
        if (freshTop < 0) freshTop = 0;
        if (Math.abs(freshTop - getY()) > 2) {
          window.scrollTo({ top: freshTop, left: 0, behavior: "instant" });
          lastY = getY();
        }
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(reCheck).catch(function () {});
      }
      window.addEventListener("load", reCheck, { once: true });
      setTimeout(reCheck, 400);
      setTimeout(reCheck, 1200);
    }

    // In-page nav: handle every same-page anchor (`a[href^="#"]`, wherever it
    // sits — nav, drawer, hero CTA, sticky CTA) AND any `[data-scroll-to]`
    // trigger (short's sticky/drawer CTA use that instead of a real href).
    // Routing all of it through one place is the point: a hero/sticky CTA that
    // scrolled on its own product script (short's common.js; irem's
    // irem-enhance.js, which bound its own smooth-scroll to every a[href^="#"])
    // used a different offset/animation than the nav links, so the same target
    // landed differently depending on which control you clicked. Document-level
    // capture + stopPropagation beats those per-element handlers so ours always
    // wins.
    document.addEventListener(
      "click",
      function (e) {
        var trigger = e.target && e.target.closest
          ? e.target.closest('a[href^="#"], [data-scroll-to]')
          : null;
        if (!trigger) return;
        var scrollToId = trigger.getAttribute("data-scroll-to");
        var isAnchor = !scrollToId;
        var id = scrollToId || trigger.getAttribute("href").slice(1);
        if (!id) return;
        var target = document.getElementById(id) || document.querySelector('[data-section="' + id + '"]');
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        // Close first: on mobile the open drawer sets body overflow:hidden, which
        // blocks the scroll below. Releasing it before scrolling is essential.
        close();
        // No header offset: land on the target's true top edge and let the
        // floating (translucent, sticky) header sit on top of it, same as it
        // would if the user had scrolled there by hand. Offsetting by the
        // header's height instead leaves a gap between the header and the
        // section below it, exposing blank space above the content.
        var offset = 0;
        var top = target.getBoundingClientRect().top + getY() - offset;
        if (top < 0) top = 0;
        // Instant jump: sections sit far down a long page, so a smooth scroll
        // over thousands of px reads as sluggish/broken. NB: "auto" would NOT
        // give us that — per spec "auto" defers to the CSS `scroll-behavior`
        // property, which both themes set to `smooth`, so it silently animates
        // anyway. Only the literal "instant" forces a true jump.
        window.scrollTo({ top: top, left: 0, behavior: "instant" });
        lastY = getY();
        // irem's `.reveal` elements fade in via IntersectionObserver as you scroll
        // past them; jumping straight there skips that pass, so whatever's now
        // on screen is still sitting at its pre-reveal opacity:0 — a blank hole
        // that only fills in ~0.7s later. Since we already made the jump itself
        // instant, finish the job: reveal on-screen `.reveal` elements immediately
        // too, no animation, so landing looks stable right away.
        var viewH = window.innerHeight || document.documentElement.clientHeight;
        var revealEls = document.querySelectorAll(".reveal:not(.in)");
        for (var r = 0; r < revealEls.length; r += 1) {
          var rTop = revealEls[r].getBoundingClientRect().top;
          if (rTop < viewH && rTop > -viewH) revealEls[r].classList.add("in");
        }
        settleScroll(target, top, offset);
        if (isAnchor && history.replaceState) history.replaceState(null, "", "#" + id);
      },
      true
    );

    // Non-anchor picks inside the drawer (e.g. the .openModal CTA on short) just
    // close it; their own handlers still run on the bubble phase.
    panel.addEventListener("click", function (e) {
      var hit = e.target && e.target.closest ? e.target.closest("a, button") : null;
      if (hit) close();
    });

    document.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && isOpen()) close();
    });

    // Floating header: hide on scroll-down, reveal on scroll-up. Direct scroll
    // handler (no rAF) so it stays reliable regardless of frame scheduling.
    lastY = getY();
    window.addEventListener(
      "scroll",
      function () {
        if (isOpen()) return;
        var y = getY();
        if (y <= 8) {
          nav.classList.remove("cw-nav--hidden");
          lastY = y;
          return;
        }
        if (y > lastY + 6 && y > 90) {
          nav.classList.add("cw-nav--hidden");
          lastY = y;
        } else if (y < lastY - 6) {
          nav.classList.remove("cw-nav--hidden");
          lastY = y;
        }
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* Hero background video (short's `[data-cw-video-bg]`). No `autoplay` in the
   markup on purpose — we decide whether to play at all, so users on
   prefers-reduced-motion or a metered/slow connection just get the poster
   frame (already the first frame of the clip) as a static hero image instead
   of downloading and animating video for no benefit to them.

   AND NOT UNTIL THE PAGE HAS LOADED (2026-08-28). The clip is 566 KB and it
   was being fetched from DOMContentLoaded, which put it in the same queue as
   the stylesheets and the first images of the page it sits behind. The poster
   is already on screen by then and is the clip's own first frame, so nothing
   is missing while it waits — the hero simply starts moving a moment later,
   on the first idle after load. */
(function () {
  if (typeof document === "undefined") return;

  function init() {
    var boxes = document.querySelectorAll("[data-cw-video-bg]");
    if (!boxes.length) return;

    var reducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
    var metered =
      conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""));

    if (reducedMotion || metered) return;

    for (var i = 0; i < boxes.length; i += 1) {
      var video = boxes[i].querySelector("video");
      if (!video) continue;

      /* The markup ships the source in `data-src` so that nothing is fetched
         until here. `preload="none"` alone was not enough: the clip was
         measured starting at 314 ms, in front of the stylesheets and images of
         the screen it sits behind. Attaching the source and calling load() is
         the point at which this page asks for 566 KB — after the load event,
         on an idle callback, with the poster already on screen. */
      var source = video.querySelector("source[data-src]");
      if (source) {
        source.setAttribute("src", source.getAttribute("data-src"));
        source.removeAttribute("data-src");
        video.setAttribute("preload", "auto");
        video.load();
      }

      play(video);
    }
  }

  /* A hidden tab refuses playback, and a visitor who opened this page in a
     background tab would come back to a frozen first frame. So a rejected
     play() is not the end of it: try again the next time the document is
     actually visible. */
  function play(video) {
    if (!video.play) return;
    var attempt = video.play();
    if (!attempt || !attempt.catch) return;
    attempt.catch(function () {
      if (!document.hidden) return;
      document.addEventListener(
        "visibilitychange",
        function again() {
          if (document.hidden) return;
          document.removeEventListener("visibilitychange", again);
          video.play && video.play().catch(function () {});
        },
        false
      );
    });
  }

  function whenIdle() {
    if (window.requestIdleCallback) window.requestIdleCallback(init, { timeout: 3000 });
    else window.setTimeout(init, 1200);
  }

  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle);
})();
