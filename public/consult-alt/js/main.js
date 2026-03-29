(function () {
  "use strict";

  var API_BASE = window.CW_API_BASE || window.location.origin;
  var EVENTS_ENDPOINT = API_BASE + "/api/events";
  var PRODUCT = "consult";
  var CONTENT_NAME = "CenterWay Consultation";

  /* ── Utilities ────────────────────────────────────────── */

  function makeEventId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  }

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : "";
  }

  function getSessionId() {
    try {
      var key = "cw_session_id";
      var existing = sessionStorage.getItem(key);
      if (existing) return existing;
      var generated = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(key, generated);
      return generated;
    } catch (_) {
      return "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    }
  }

  function collectAttrib() {
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "cr", "lv"];
    var qs = new URLSearchParams(window.location.search);
    var stored = {};
    var out = {};

    try { stored = JSON.parse(localStorage.getItem("cw_attrib") || "{}"); } catch (_) {}

    keys.forEach(function (key) {
      var direct = qs.get(key);
      if (direct) out[key] = direct;
      else if (stored[key]) out[key] = stored[key];
    });

    out.referrer   = document.referrer || "";
    out.page_url   = window.location.href;
    out.user_agent = navigator.userAgent || "";
    out.fbp        = readCookie("_fbp");
    return out;
  }

  function persistAttrib() {
    var qs = new URLSearchParams(window.location.search);
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "cr", "lv"];
    var data = {};
    keys.forEach(function (key) {
      var v = qs.get(key);
      if (v) data[key] = v;
    });
    if (Object.keys(data).length) {
      try { localStorage.setItem("cw_attrib", JSON.stringify(data)); } catch (_) {}
    }
  }

  function sendCapiEvent(payload) {
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        if (navigator.sendBeacon(EVENTS_ENDPOINT, blob)) return;
      }
      fetch(EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify(payload)
      });
    } catch (_) {}
  }

  /* ── ViewContent ──────────────────────────────────────── */

  function maybeTrackViewContent() {
    var sentKey = "cw_viewcontent_sent::" + window.location.pathname;
    try { if (sessionStorage.getItem(sentKey) === "1") return; } catch (_) {}

    var attrib  = collectAttrib();
    var eventId = makeEventId("viewcontent_" + PRODUCT);

    if (typeof fbq === "function") {
      fbq("track", "ViewContent",
        { content_name: CONTENT_NAME, content_type: "service", content_ids: [PRODUCT] },
        { eventID: eventId }
      );
    }

    sendCapiEvent({
      event_name: "ViewContent",
      event_id: eventId,
      page_url: attrib.page_url,
      fbclid: attrib.fbclid,
      fbp: attrib.fbp,
      utm_source: attrib.utm_source,
      utm_medium: attrib.utm_medium,
      utm_campaign: attrib.utm_campaign,
      utm_content: attrib.utm_content,
      utm_term: attrib.utm_term,
      session_id: getSessionId(),
      product: PRODUCT,
      content_name: CONTENT_NAME,
      content_type: "service",
      content_ids: [PRODUCT]
    });

    try { sessionStorage.setItem(sentKey, "1"); } catch (_) {}
  }

  /* ── Scroll depth 50% ─────────────────────────────────── */

  function setupScrollDepth50() {
    var sent = false;
    var sentKey = "cw_scroll50_sent::" + window.location.pathname;
    try { if (sessionStorage.getItem(sentKey) === "1") sent = true; } catch (_) {}

    function maybeSend() {
      if (sent) return;
      var doc    = document.documentElement;
      var scrollTop      = window.scrollY || doc.scrollTop || 0;
      var viewportHeight = window.innerHeight || doc.clientHeight || 0;
      var totalHeight    = Math.max(doc.scrollHeight || 0, doc.offsetHeight || 0);
      if (!totalHeight) return;
      if (((scrollTop + viewportHeight) / totalHeight) * 100 < 50) return;

      sent = true;
      try { sessionStorage.setItem(sentKey, "1"); } catch (_) {}

      var attrib = collectAttrib();
      sendCapiEvent({
        event_name: "ScrollDepth50",
        event_id: makeEventId("scroll50_" + PRODUCT),
        page_url: attrib.page_url,
        fbclid: attrib.fbclid,
        fbp: attrib.fbp,
        utm_source: attrib.utm_source,
        utm_medium: attrib.utm_medium,
        utm_campaign: attrib.utm_campaign,
        utm_content: attrib.utm_content,
        utm_term: attrib.utm_term,
        session_id: getSessionId(),
        depth_percent: 50,
        product: PRODUCT
      });

      window.removeEventListener("scroll", maybeSend);
      window.removeEventListener("resize", maybeSend);
    }

    window.addEventListener("scroll", maybeSend, { passive: true });
    window.addEventListener("resize", maybeSend);
    setTimeout(maybeSend, 350);
  }

  /* ── CTA tracking ─────────────────────────────────────── */

  function setupCtas() {
    document.querySelectorAll(".js-consult-cta").forEach(function (cta) {
      cta.addEventListener("click", function () {
        var attrib   = collectAttrib();
        var ctaPlace = cta.getAttribute("data-cta-place") || "unknown";
        var eventId  = makeEventId("consult_cta");

        if (typeof fbq === "function") {
          fbq("track", "Lead",
            { content_name: CONTENT_NAME, product: PRODUCT, cta_place: ctaPlace },
            { eventID: eventId }
          );
        }

        sendCapiEvent({
          event_name: "ConsultCTA",
          event_id: eventId,
          page_url: attrib.page_url,
          fbclid: attrib.fbclid,
          fbp: attrib.fbp,
          utm_source: attrib.utm_source,
          utm_medium: attrib.utm_medium,
          utm_campaign: attrib.utm_campaign,
          utm_content: attrib.utm_content,
          utm_term: attrib.utm_term,
          session_id: getSessionId(),
          product: PRODUCT,
          cta_place: ctaPlace,
          target: cta.getAttribute("href") || ""
        });
      });
    });
  }

  /* ── Sticky CTA ───────────────────────────────────────── */

  function setupStickyCta() {
    var sticky  = document.getElementById("sticky-cta");
    var heroCta = document.querySelector('[data-cta-place="hero"]');
    if (!sticky || !heroCta) return;

    function check() {
      var heroOut = heroCta.getBoundingClientRect().bottom <= 0;
      sticky.classList.toggle("visible", heroOut);
      sticky.setAttribute("aria-hidden", heroOut ? "false" : "true");
    }

    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    check();
  }

  /* ── Route nav scroll shadow + active node ────────────── */

  function setupRouteNav() {
    var nav = document.getElementById("route-nav");
    if (!nav) return;

    // Shadow on scroll
    window.addEventListener("scroll", function () {
      nav.classList.toggle("scrolled", window.scrollY > 8);
    }, { passive: true });

    // Active section highlighting
    var nodes = document.querySelectorAll(".js-route-node");
    var sections = Array.from(nodes).map(function (node) {
      var id = node.getAttribute("data-target");
      return document.getElementById(id);
    });

    function updateActive() {
      var scrollMid = window.scrollY + window.innerHeight / 3;
      var activeIdx = 0;
      sections.forEach(function (sec, i) {
        if (sec && sec.offsetTop <= scrollMid) activeIdx = i;
      });
      nodes.forEach(function (node, i) {
        node.classList.toggle("is-active", i === activeIdx);
      });
    }

    window.addEventListener("scroll", updateActive, { passive: true });
    updateActive();
  }

  /* ── Fit tabs ─────────────────────────────────────────── */

  function setupFitTabs() {
    var tabs   = document.querySelectorAll(".fit-tab");
    var panels = document.querySelectorAll(".fit-panel");
    var fitPanels = document.querySelector(".fit-panels");
    if (!tabs.length) return;

    function setStablePanelsHeight() {
      if (!fitPanels) return;

      var maxHeight = 0;
      panels.forEach(function (panel) {
        var wasHidden = panel.hidden;
        var prevDisplay = panel.style.display;
        var prevVisibility = panel.style.visibility;

        if (wasHidden) {
          panel.hidden = false;
          panel.style.display = "block";
          panel.style.visibility = "hidden";
        }

        maxHeight = Math.max(maxHeight, panel.offsetHeight || 0);

        if (wasHidden) {
          panel.hidden = true;
          panel.style.display = prevDisplay;
          panel.style.visibility = prevVisibility;
        }
      });

      if (maxHeight > 0) {
        fitPanels.style.minHeight = maxHeight + "px";
      }
    }

    setStablePanelsHeight();
    window.addEventListener("resize", setStablePanelsHeight);

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var targetId = "fit-panel-" + tab.getAttribute("data-tab");

        tabs.forEach(function (t) {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });

        panels.forEach(function (p) {
          p.classList.remove("is-active");
          p.hidden = true;
        });

        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");

        var panel = document.getElementById(targetId);
        if (panel) {
          panel.classList.add("is-active");
          panel.hidden = false;
        }

        setStablePanelsHeight();
      });
    });
  }

  /* ── Reveal on scroll ─────────────────────────────────── */

  function setupReveal() {
    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach(function (n) { n.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    targets.forEach(function (t) { observer.observe(t); });
  }

  /* ── Price format ─────────────────────────────────────── */

  function formatPrice() {
    var card = document.querySelector(".pricing-shell[data-price-value]") ||
               document.querySelector("[data-price-value]");
    if (!card) return;
    var value = Number(card.getAttribute("data-price-value"));
    if (!Number.isFinite(value)) return;
    var formatted = value.toLocaleString("uk-UA");
    document.querySelectorAll(".js-price-value").forEach(function (node) {
      node.textContent = formatted;
    });
  }

  /* ── Init ─────────────────────────────────────────────── */

  persistAttrib();
  formatPrice();
  maybeTrackViewContent();
  setupScrollDepth50();
  setupCtas();
  setupStickyCta();
  setupRouteNav();
  setupFitTabs();
  setupReveal();

})();
