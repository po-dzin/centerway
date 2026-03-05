(function() {
  var API_BASE = window.CW_API_BASE || window.location.origin;
  var DIRECT_PAY_ENDPOINT = API_BASE + "/api/pay/start";
  var EVENTS_ENDPOINT = API_BASE + "/api/events";
  var PRODUCT = "irem";
  var OFFER_ID = "irem_main_4100";
  var PRICE_VALUE = 4100;
  var CURRENCY = "UAH";
  var CONTENT_NAME = "IREM";
  var REDIRECT_RESET_MS = 5000;
  var isRedirecting = false;

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : "";
  }

  function makeEventId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
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


  function buildPayUrl(attrib, eventId) {
    var url = new URL(DIRECT_PAY_ENDPOINT, window.location.origin);
    url.searchParams.set("product", PRODUCT);
    url.searchParams.set("site", PRODUCT);
    url.searchParams.set("offer_id", OFFER_ID);
    url.searchParams.set("value", String(PRICE_VALUE));
    url.searchParams.set("currency", CURRENCY);
    url.searchParams.set("event_id", eventId);

    var queryKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "cr", "lv", "fbp"];
    queryKeys.forEach(function(key) {
      var value = attrib[key];
      if (value) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
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
      email: leadPayload && leadPayload.email,
      phone: leadPayload && leadPayload.phone
    });
  };
})();


! function(i) {
  var o, n;
  i(".title_block").on("click", function() {
    o = i(this).parents(".accordion_item"), n = o.find(".info"),
      o.hasClass("active_block") ? (o.removeClass("active_block"),
        n.slideUp()) : (o.addClass("active_block"), n.stop(!0, !0).slideDown(),
        o.siblings(".active_block").removeClass("active_block").children(
          ".info").stop(!0, !0).slideUp())
  })
}(jQuery);

$(document).ready(function(){
    var $menu = $("#menu");
    var $topCta = $(".s1 .openModal");
    var $bottomCta = $(".s10 .openModal");

    function isInViewport($el) {
        if (!$el.length) {
            return false;
        }
        var rect = $el[0].getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
    }

    function shouldShowMenu() {
        var topVisible = isInViewport($topCta);
        var bottomVisible = isInViewport($bottomCta);
        var topPassed = false;

        if ($topCta.length) {
            var topRect = $topCta[0].getBoundingClientRect();
            topPassed = topRect.bottom <= 0;
        } else {
            topPassed = window.scrollY > 120;
        }

        return topPassed && !topVisible && !bottomVisible;
    }

    function updateMenu() {
        if (shouldShowMenu() && $menu.hasClass("default")) {
            $menu.removeClass("default").addClass("fixed");
        } else if (!shouldShowMenu() && $menu.hasClass("fixed")) {
            $menu.removeClass("fixed").addClass("default");
        }
    }

    $(window).on("scroll resize", updateMenu);
    updateMenu();
});

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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReviewsCarousel);
} else {
    initReviewsCarousel();
}
