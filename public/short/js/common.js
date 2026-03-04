(function() {
  var API_BASE = window.CW_API_BASE || window.location.origin;
  var DIRECT_PAY_ENDPOINT = API_BASE + "/api/pay/start";
  var EVENTS_ENDPOINT = API_BASE + "/api/events";
  var PRODUCT = "short";
  var OFFER_ID = "short_reboot_359";
  var PRICE_VALUE = 359;
  var CURRENCY = "UAH";
  var CONTENT_NAME = "Short Reboot";
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
function newDate() {
  var time = new Date();
  var date_now =  new Date();
  date_now.setDate(date_now.getDate() + 1);
  $(".date-block").text(date_now.toLocaleString('uk-ua', {
    day: 'numeric',
    month: 'long' 
  }));
}
setTimeout(newDate, 100);

var myDate = new Date();
function returnEndDate(d,h,m){
  myDate.setDate(myDate.getDate()+d);
  myDate.setHours(myDate.getHours()+h);
  myDate.setMinutes(myDate.getMinutes()+m);
  return myDate;
}
if($.cookie("time-timer1")){
  var dateEnd = $.cookie("time-timer1");
}else{
  var dateEnd = returnEndDate(0,3,0); 
  $.cookie("time-timer1", dateEnd, {expires: 7});
}
var date = new Date($.cookie("time-timer1"));
    $(".getting-started").countdown(date, function(event) {
  $(this).html(
  event.strftime(''
  +'<div class="hr"><div class="dial">%H</div>годин</div>'
  +'<div class="min"><div class="dial">%M</div>хвилин</div>'
  +'<div class="sec"><div class="dial">%S</div>секунд</div>'));
});

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
    var $bottomCta = $(".s11 .openModal");
    function isInViewport($el) {
        if (!$el.length) {
            return false;
        }
        var rect = $el[0].getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
    }

    function shouldShowMenu() {
        var isTablet = window.matchMedia("(min-width: 601px) and (max-width: 1023px)").matches;
        var firstScreenHeight = isTablet ? ($(".s1").outerHeight() || window.innerHeight) : window.innerHeight;
        var pastFirstScreen = window.scrollY > firstScreenHeight;
        var topVisible = isInViewport($topCta);
        var bottomVisible = isInViewport($bottomCta);
        return pastFirstScreen && !topVisible && !bottomVisible;
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

$(document).ready(function(){
    $(".reviews-carousel").each(function(){
        var $carousel = $(this);
        var $track = $carousel.find(".reviews-track");
        var $items = $track.find(".reviews-item");
        var scrollAmount = $items.first().outerWidth(true) || 320;

        $carousel.find(".carousel-btn.prev").on("click", function(){
            $track[0].scrollBy({ left: -scrollAmount, behavior: "smooth" });
        });

        $carousel.find(".carousel-btn.next").on("click", function(){
            $track[0].scrollBy({ left: scrollAmount, behavior: "smooth" });
        });
    });
});
$( ".showmore" ).click(function() {
    $(this).hide();
    $('.hidd').slideDown('slow');
});
