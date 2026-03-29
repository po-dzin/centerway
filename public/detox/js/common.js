(function () {
  var API_BASE = window.CW_API_BASE || window.location.origin;
  var EVENTS_ENDPOINT = API_BASE + "/api/events";
  var PRODUCT = "detox";
  var CONTENT_NAME = "CenterWay Detox";

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
    var keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "cr",
      "lv"
    ];

    var qs = new URLSearchParams(window.location.search);
    var out = {};
    var stored = {};

    try {
      stored = JSON.parse(localStorage.getItem("cw_attrib") || "{}");
    } catch (_) {
      stored = {};
    }

    keys.forEach(function (key) {
      var direct = qs.get(key);
      if (direct) {
        out[key] = direct;
      } else if (stored[key]) {
        out[key] = stored[key];
      }
    });

    out.referrer = document.referrer || "";
    out.page_url = window.location.href;
    out.user_agent = navigator.userAgent || "";
    out.fbp = readCookie("_fbp");
    return out;
  }

  function persistAttrib() {
    var qs = new URLSearchParams(window.location.search);
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "cr", "lv"];
    var data = {};

    keys.forEach(function (key) {
      var value = qs.get(key);
      if (value) {
        data[key] = value;
      }
    });

    if (Object.keys(data).length) {
      try {
        localStorage.setItem("cw_attrib", JSON.stringify(data));
      } catch (_) {}
    }
  }

  function sendCapiEvent(payload) {
    try {
      if (navigator.sendBeacon) {
        var body = JSON.stringify(payload);
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(EVENTS_ENDPOINT, blob)) {
          return;
        }
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

  function maybeTrackViewContent() {
    var sentKey = "cw_viewcontent_sent::" + window.location.pathname;

    try {
      if (sessionStorage.getItem(sentKey) === "1") {
        return;
      }
    } catch (_) {}

    var attrib = collectAttrib();
    var eventId = makeEventId("viewcontent_" + PRODUCT);

    if (typeof fbq === "function") {
      fbq(
        "track",
        "ViewContent",
        {
          content_name: CONTENT_NAME,
          content_type: "service",
          content_ids: [PRODUCT]
        },
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

    try {
      sessionStorage.setItem(sentKey, "1");
    } catch (_) {}
  }

  function setupScrollDepth50() {
    var sent = false;
    var sentKey = "cw_scroll50_sent::" + window.location.pathname;

    try {
      if (sessionStorage.getItem(sentKey) === "1") {
        sent = true;
      }
    } catch (_) {}

    function maybeSend() {
      if (sent) return;

      var doc = document.documentElement;
      var body = document.body;
      var scrollTop = window.scrollY || doc.scrollTop || 0;
      var viewportHeight = window.innerHeight || doc.clientHeight || 0;
      var totalHeight = Math.max(
        doc.scrollHeight || 0,
        body ? body.scrollHeight : 0,
        doc.offsetHeight || 0,
        body ? body.offsetHeight : 0
      );

      if (!totalHeight) return;

      var progress = ((scrollTop + viewportHeight) / totalHeight) * 100;
      if (progress < 50) return;

      sent = true;
      try {
        sessionStorage.setItem(sentKey, "1");
      } catch (_) {}

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

  function setupCtas() {
    var ctas = document.querySelectorAll(".js-detox-cta");

    ctas.forEach(function (cta) {
      cta.addEventListener("click", function () {
        var attrib = collectAttrib();
        var ctaPlace = cta.getAttribute("data-cta-place") || "unknown";
        var eventId = makeEventId("detox_cta");

        if (typeof fbq === "function") {
          fbq(
            "track",
            "Lead",
            {
              content_name: CONTENT_NAME,
              product: PRODUCT,
              cta_place: ctaPlace
            },
            { eventID: eventId }
          );
        }

        sendCapiEvent({
          event_name: "DetoxCTA",
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

  function setupStickyCta() {
    var sticky = document.getElementById("sticky-cta");
    var heroCta = document.querySelector('[data-cta-place="hero"]');
    var pricingCta = document.querySelector('[data-cta-place="pricing"]');
    var stickyBtn = sticky ? sticky.querySelector(".btn") : null;

    if (!sticky || !heroCta) return;

    function syncStickySize() {
      if (!stickyBtn) return;
      if (window.innerWidth <= 760) {
        stickyBtn.style.removeProperty("width");
        return;
      }
      var heroWidth = Math.round(heroCta.getBoundingClientRect().width);
      if (heroWidth > 0) {
        stickyBtn.style.width = heroWidth + "px";
      }
    }

    function shouldShowSticky() {
      var heroRect = heroCta.getBoundingClientRect();
      var heroOutOfView = heroRect.bottom <= 0;
      var pricingInView = false;

      if (pricingCta) {
        var pricingRect = pricingCta.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        pricingInView = pricingRect.top < viewportHeight && pricingRect.bottom > 0;
      }

      var shouldShow = heroOutOfView && !pricingInView;
      sticky.classList.toggle("visible", shouldShow);
      sticky.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    }

    function onViewportChange() {
      syncStickySize();
      shouldShowSticky();
    }

    window.addEventListener("scroll", shouldShowSticky, { passive: true });
    window.addEventListener("resize", onViewportChange);
    syncStickySize();
    shouldShowSticky();
  }

  function setupRevealAnimation() {
    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.1
      }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  function formatPrice() {
    var card = document.querySelector(".pricing-card[data-price-value]");
    if (!card) return;
    var value = Number(card.getAttribute("data-price-value"));
    if (!Number.isFinite(value)) return;

    var formatted = value.toLocaleString("uk-UA");
    document.querySelectorAll(".js-price-value").forEach(function (node) {
      node.textContent = formatted;
    });
  }

  persistAttrib();
  formatPrice();
  maybeTrackViewContent();
  setupScrollDepth50();
  setupCtas();
  setupStickyCta();
  setupRevealAnimation();
})();
