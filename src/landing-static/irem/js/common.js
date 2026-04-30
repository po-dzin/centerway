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

  function ensureClarity() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (typeof window.clarity !== "function") {
      window.clarity = function() {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
    }
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
  }

  ensureClarity();

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : "";
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
    out.fbc = readCookie("_fbc");
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

  function setupYoutubeIframeRecovery() {
    var selector = 'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]';
    var frames = document.querySelectorAll(selector);

    function tryRecover(iframe) {
      if (!(iframe instanceof HTMLIFrameElement)) return;
      var originalSrc = iframe.getAttribute("src") || "";
      if (!originalSrc) return;

      var fallbackSrc = originalSrc.indexOf("youtube-nocookie.com") >= 0
        ? originalSrc
        : originalSrc.replace("www.youtube.com", "www.youtube-nocookie.com");
      var attempt = Number(iframe.getAttribute("data-cw-embed-attempt") || "0");
      if (attempt >= 2) return;

      var currentHref = "";
      try {
        currentHref = iframe.contentWindow && iframe.contentWindow.location
          ? iframe.contentWindow.location.href
          : "";
      } catch (_) {
        // Cross-origin access error means iframe navigated away from about:blank and is loading.
        return;
      }

      if (currentHref !== "" && currentHref !== "about:blank" && currentHref !== "about:srcdoc") {
        return;
      }

      iframe.setAttribute("data-cw-embed-attempt", String(attempt + 1));
      iframe.src = attempt === 0 ? originalSrc : fallbackSrc;
    }

    frames.forEach(function(iframe) {
      setTimeout(function() { tryRecover(iframe); }, 400);
      setTimeout(function() { tryRecover(iframe); }, 1400);
      iframe.addEventListener("load", function() {
        setTimeout(function() { tryRecover(iframe); }, 120);
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
  setupYoutubeIframeRecovery();
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
