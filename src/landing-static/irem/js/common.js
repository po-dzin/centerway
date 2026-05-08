(function() {
  var API_BASE = window.CW_API_BASE || window.location.origin;
  var DIRECT_PAY_ENDPOINT = API_BASE + "/api/pay/start";
  var EVENTS_ENDPOINT = API_BASE + "/api/events";
  var PRODUCT = "irem";
  var OFFER_ID = "irem_main_4100";
  var PRICE_VALUE = 4100;
  var CURRENCY = "UAH";
  var CONTENT_NAME = "IREM";
  var CLARITY_PROJECT_ID = "vy9u7jygno";
  var REDIRECT_RESET_MS = 5000;
  var isRedirecting = false;
  var deferredScriptStarted = {};

  function scheduleDeferredScript(key, callback) {
    if (deferredScriptStarted[key]) return;
    deferredScriptStarted[key] = true;

    var done = false;
    function run() {
      if (done) return;
      done = true;
      window.removeEventListener("pointerdown", run, true);
      window.removeEventListener("touchstart", run, true);
      window.removeEventListener("keydown", run, true);
      window.removeEventListener("scroll", run, true);
      callback();
    }

    window.addEventListener("pointerdown", run, true);
    window.addEventListener("touchstart", run, true);
    window.addEventListener("keydown", run, true);
    window.addEventListener("scroll", run, true);
    window.setTimeout(run, 12000);
  }

  function ensureClarity() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (typeof window.clarity !== "function") {
      window.clarity = function() {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
    }
    scheduleDeferredScript("clarity", function() {
      var existingClarityScript = document.querySelector('script[src*="clarity.ms/tag/"]');
      if (existingClarityScript || document.querySelector('script[data-cw-clarity="1"]')) {
        return;
      }
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://www.clarity.ms/tag/" + CLARITY_PROJECT_ID;
      script.setAttribute("data-cw-clarity", "1");
      var firstScript = document.getElementsByTagName("script")[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        document.head.appendChild(script);
      }
    });
  }

  ensureClarity();

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : "";
  }

  function buildFbcFromFbclid(fbclid) {
    return "fb.1." + Math.floor(Date.now() / 1000) + "." + fbclid;
  }

  function makeEventId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
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


  function sendCapiEvent(payload) {
    try {
      fetch(EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify(payload)
      });
    } catch (_) {}
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
    var out = {};
    var qs = new URLSearchParams(window.location.search);
    var stored = {};

    try {
      stored = JSON.parse(localStorage.getItem("cw_attrib") || "{}");
    } catch (_) {
      stored = {};
    }

    keys.forEach(function(key) {
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
    out.fbc = readCookie("_fbc") || stored.fbc || "";
    if (!out.fbc && out.fbclid) {
      out.fbc = buildFbcFromFbclid(out.fbclid);
    }
    return out;
  }

  function setButtonsLoading(loading) {
    var buttons = document.querySelectorAll(".openModal");
    buttons.forEach(function(btn) {
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = loading;
      }
      btn.classList.toggle("is-loading", loading);
    });
  }

  function trackInitialCheckout(attrib, eventId) {
    if (typeof fbq !== "function") {
      return;
    }
    fbq("track", "InitiateCheckout", {
      value: PRICE_VALUE,
      currency: CURRENCY,
      content_name: CONTENT_NAME,
      offer_id: OFFER_ID,
      ...attrib
    }, { eventID: eventId });
  }

  function setupViewContent() {
    var sentKey = "cw_viewcontent_sent::" + window.location.pathname;
    try {
      if (sessionStorage.getItem(sentKey) === "1") {
        return;
      }
    } catch (_) {}

    var attrib = collectAttrib();
    var eventId = makeEventId("viewcontent_" + PRODUCT);

    if (typeof fbq === "function") {
      fbq("track", "ViewContent", {
        content_name: CONTENT_NAME,
        content_type: "product",
        content_ids: [PRODUCT],
        ...attrib
      }, { eventID: eventId });
    }

    sendCapiEvent({
      event_name: "ViewContent",
      event_id: eventId,
      page_url: attrib.page_url,
      fbclid: attrib.fbclid,
      fbp: attrib.fbp,
      fbc: attrib.fbc,
      utm_source: attrib.utm_source,
      utm_medium: attrib.utm_medium,
      utm_campaign: attrib.utm_campaign,
      utm_content: attrib.utm_content,
      utm_term: attrib.utm_term,
      session_id: getSessionId(),
      product: PRODUCT,
      content_name: CONTENT_NAME,
      content_type: "product",
      content_ids: [PRODUCT]
    });

    try {
      sessionStorage.setItem(sentKey, "1");
    } catch (_) {}
  }


  function buildPayUrl(attrib, eventId) {
    var url = new URL(DIRECT_PAY_ENDPOINT, window.location.origin);
    url.searchParams.set("product", PRODUCT);
    url.searchParams.set("site", PRODUCT);
    url.searchParams.set("offer_id", OFFER_ID);
    url.searchParams.set("value", String(PRICE_VALUE));
    url.searchParams.set("currency", CURRENCY);
    url.searchParams.set("event_id", eventId);

    var queryKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "cr", "lv", "fbp", "fbc"];
    queryKeys.forEach(function(key) {
      var value = attrib[key];
      if (value) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
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
      if (totalHeight <= 0) return;

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
    setTimeout(maybeSend, 300);
  }

  function createVideoFrame(wrapper) {
    if (!(wrapper instanceof HTMLElement) || wrapper.getAttribute("data-cw-video-loaded") === "1") return;

    var src = wrapper.getAttribute("data-embed-src");
    var title = wrapper.getAttribute("data-embed-title") || "Відео";
    if (!src) return;

    var iframe = document.createElement("iframe");
    iframe.className = wrapper.getAttribute("data-embed-frame-class") || "video-embed__frame";
    iframe.src = src;
    iframe.title = title;
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    iframe.setAttribute("frameborder", "0");

    wrapper.innerHTML = "";
    wrapper.appendChild(iframe);
    wrapper.setAttribute("data-cw-video-loaded", "1");
  }

  function setupDeferredVideoEmbeds() {
    document.querySelectorAll("[data-cw-video-embed]").forEach(function(wrapper) {
      var button = wrapper.querySelector(".video-embed__button");
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener("click", function() {
        createVideoFrame(wrapper);
      });
    });
  }

  document.addEventListener("click", function(event) {
    var trigger = event.target.closest(".openModal");
    if (trigger) {
      event.preventDefault();
      if (isRedirecting) {
        return;
      }
      isRedirecting = true;
      setButtonsLoading(true);
      var attrib = collectAttrib();
      var eventId = makeEventId("checkout_" + PRODUCT);
      trackInitialCheckout(attrib, eventId);
      window.location.assign(buildPayUrl(attrib, eventId));
      window.setTimeout(function() {
        isRedirecting = false;
        setButtonsLoading(false);
      }, REDIRECT_RESET_MS);
      return;
    }
  });


  // Future hook: lead form is disabled now, but this keeps Lead event integration ready.
  window.CW_trackLead = function(leadPayload) {
    var eventId = makeEventId("lead_" + PRODUCT);
    var attrib = collectAttrib();
    if (typeof fbq === "function") {
      fbq("track", "Lead", {
        ...attrib,
        ...(leadPayload || {})
      }, { eventID: eventId });
    }
    sendCapiEvent({
      event_name: "Lead",
      event_id: eventId,
      page_url: attrib.page_url,
      fbclid: attrib.fbclid,
      fbp: attrib.fbp,
      fbc: attrib.fbc,
      email: leadPayload && leadPayload.email,
      phone: leadPayload && leadPayload.phone
    });
  };

  setupViewContent();
  setupScrollDepth50();
  setupDeferredVideoEmbeds();
})();

function initAccordion() {
  var triggers = document.querySelectorAll(".title_block");
  triggers.forEach(function(trigger) {
    trigger.addEventListener("click", function() {
      var item = trigger.closest(".accordion_item");
      if (!item) return;
      var info = item.querySelector(".info");
      var isActive = item.classList.contains("active_block");

      document.querySelectorAll(".accordion_item.active_block").forEach(function(activeItem) {
        if (activeItem === item) return;
        activeItem.classList.remove("active_block");
        var activeInfo = activeItem.querySelector(".info");
        if (activeInfo) {
          activeInfo.style.display = "none";
        }
      });

      item.classList.toggle("active_block", !isActive);
      if (info) {
        info.style.display = isActive ? "none" : "block";
      }
    });
  });
}

function initStickyMenu() {
  var menu = document.querySelector("[data-sticky-menu]");
  var topCta = document.querySelector("[data-cta-primary]");
  var bottomCta = document.querySelector("[data-cta-final]");
  if (!menu) return;

  function isInViewport(element) {
    if (!element) return false;
    var rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function shouldShowMenu() {
    var topVisible = isInViewport(topCta);
    var bottomVisible = isInViewport(bottomCta);
    var topPassed = topCta ? topCta.getBoundingClientRect().bottom <= 0 : window.scrollY > 120;
    return topPassed && !topVisible && !bottomVisible;
  }

  function updateMenu() {
    menu.classList.toggle("fixed", shouldShowMenu());
    menu.classList.toggle("default", !menu.classList.contains("fixed"));
  }

  window.addEventListener("scroll", updateMenu, { passive: true });
  window.addEventListener("resize", updateMenu);
  updateMenu();
}

function initReviewsCarousel() {
  var carousels = document.querySelectorAll(".reviews-carousel");
  carousels.forEach(function(carousel) {
    var track = carousel.querySelector(".reviews-track");
    var prev = carousel.querySelector(".carousel-btn.prev");
    var next = carousel.querySelector(".carousel-btn.next");
    if (!track || !prev || !next) {
      return;
    }
    var scrollByAmount = function() {
      return Math.max(240, Math.floor(track.clientWidth * 0.8));
    };
    prev.addEventListener("click", function() {
      track.scrollBy({ left: -scrollByAmount(), behavior: "smooth" });
    });
    next.addEventListener("click", function() {
      track.scrollBy({ left: scrollByAmount(), behavior: "smooth" });
    });
  });
}

function initIremLanding() {
  initAccordion();
  initStickyMenu();
  initReviewsCarousel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIremLanding, { once: true });
} else {
  initIremLanding();
}
