(function() {
  var API_BASE = window.CW_API_BASE || window.location.origin;
  var CHECKOUT_ENDPOINT = API_BASE + "/api/checkout/start";
  var SITE_KEY = "irem";
  var OFFER_ID = "irem_main_4100";
  var PRICE_VALUE = 4100;
  var CURRENCY = "UAH";
  var CONTENT_NAME = "IREM";
  var PHONE_PREFIX = "+380";
  var PHONE_BODY_DIGITS = 9;
  var modal = document.getElementById("precheckoutModal");
  var form = document.getElementById("precheckoutForm");

  if (!modal || !form) {
    return;
  }

  var emailInput = document.getElementById("precheckoutEmail");
  var phoneInput = document.getElementById("precheckoutPhone");
  var submitButton = document.getElementById("precheckoutSubmit");
  var submitText = submitButton ? submitButton.querySelector(".precheckout-modal__submit-text") : null;
  var emailError = document.getElementById("precheckoutEmailError");
  var phoneError = document.getElementById("precheckoutPhoneError");
  var serverError = document.getElementById("precheckoutServerError");
  var lastFocusedTrigger = null;
  var isSubmitting = false;

  function getEventId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function normalizeEmail(value) {
    return (value || "").trim().toLowerCase();
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function extractPhoneBodyDigits(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (!digits) {
      return "";
    }
    if (digits.indexOf("380") === 0) {
      return digits.slice(3);
    }
    if (digits.charAt(0) === "0") {
      return digits.slice(1);
    }
    return digits;
  }

  function formatPhoneForInput(value) {
    var body = extractPhoneBodyDigits(value).slice(0, PHONE_BODY_DIGITS);
    return PHONE_PREFIX + body;
  }

  function normalizePhone(value) {
    var body = extractPhoneBodyDigits(value).slice(0, PHONE_BODY_DIGITS);
    if (body.length !== PHONE_BODY_DIGITS) {
      return "";
    }
    return PHONE_PREFIX + body;
  }

  function isValidNormalizedPhone(value) {
    return /^\+380\d{9}$/.test(value);
  }

  function setFieldError(input, errorNode, message) {
    if (!input || !errorNode) {
      return;
    }
    var fieldWrap = input.parentElement;
    if (fieldWrap && fieldWrap.classList) {
      fieldWrap.classList.toggle("is-error", !!message);
    }
    errorNode.textContent = message || "";
  }

  function setServerError(message) {
    if (!serverError) {
      return;
    }
    serverError.textContent = message || "";
    serverError.classList.toggle("is-visible", !!message);
  }

  function trackInitialCheckout() {
    if (typeof fbq !== "function") {
      return;
    }
    var attrib = collectAttrib();
    fbq("track", "InitiateCheckout", {
      value: PRICE_VALUE,
      currency: CURRENCY,
      content_name: CONTENT_NAME,
      offer_id: OFFER_ID,
      ...attrib
    });
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
    return out;
  }

  function setLoading(loading) {
    isSubmitting = loading;
    if (emailInput) {
      emailInput.disabled = loading;
    }
    if (phoneInput) {
      phoneInput.disabled = loading;
    }
    if (submitButton) {
      submitButton.disabled = loading;
      submitButton.classList.toggle("is-loading", loading);
    }
    if (submitText) {
      submitText.textContent = loading ? "Зачекайте..." : "Оплатити";
    }
  }

  function getFocusableEls() {
    return modal.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !modal.classList.contains("is-open")) {
      return;
    }

    var focusables = getFocusableEls();
    if (!focusables.length) {
      return;
    }

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openModal(trigger) {
    lastFocusedTrigger = trigger || null;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setServerError("");
    setFieldError(emailInput, emailError, "");
    setFieldError(phoneInput, phoneError, "");
    if (phoneInput && !phoneInput.value) {
      phoneInput.value = PHONE_PREFIX;
    }
    if (emailInput) {
      emailInput.focus();
    }
  }

  if (phoneInput) {
    phoneInput.maxLength = PHONE_PREFIX.length + PHONE_BODY_DIGITS;

    phoneInput.addEventListener("focus", function() {
      phoneInput.value = formatPhoneForInput(phoneInput.value || PHONE_PREFIX);
      var end = phoneInput.value.length;
      phoneInput.setSelectionRange(end, end);
    });

    phoneInput.addEventListener("click", function() {
      if ((phoneInput.selectionStart || 0) < PHONE_PREFIX.length) {
        var end = phoneInput.value.length;
        phoneInput.setSelectionRange(end, end);
      }
    });

    phoneInput.addEventListener("keydown", function(event) {
      var start = phoneInput.selectionStart || 0;
      var end = phoneInput.selectionEnd || 0;
      var isDelete = event.key === "Backspace" || event.key === "Delete";
      var isMeta = event.ctrlKey || event.metaKey || event.altKey;

      if (isDelete && start <= PHONE_PREFIX.length && end <= PHONE_PREFIX.length) {
        event.preventDefault();
        return;
      }

      if (event.key.length === 1 && !/\d/.test(event.key) && !isMeta) {
        event.preventDefault();
      }
    });

    phoneInput.addEventListener("input", function() {
      var formatted = formatPhoneForInput(phoneInput.value);
      phoneInput.value = formatted;
      var caret = Math.max(PHONE_PREFIX.length, phoneInput.value.length);
      phoneInput.setSelectionRange(caret, caret);
    });

    if (!phoneInput.value) {
      phoneInput.value = PHONE_PREFIX;
    } else {
      phoneInput.value = formatPhoneForInput(phoneInput.value);
    }
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === "function") {
      lastFocusedTrigger.focus();
    }
  }

  document.addEventListener("click", function(event) {
    var trigger = event.target.closest(".openModal");
    if (trigger) {
      event.preventDefault();
      trackInitialCheckout();
      openModal(trigger);
      return;
    }

    if (event.target.closest("[data-modal-close]") && modal.classList.contains("is-open")) {
      event.preventDefault();
      closeModal();
    }
  });

  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
      return;
    }
    trapFocus(event);
  });

  form.addEventListener("submit", function(event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setServerError("");

    var email = normalizeEmail(emailInput ? emailInput.value : "");
    var normalizedPhone = normalizePhone(phoneInput ? phoneInput.value : "");

    var hasError = false;

    if (!validateEmail(email)) {
      setFieldError(emailInput, emailError, "Введіть коректний email");
      hasError = true;
    } else {
      setFieldError(emailInput, emailError, "");
      if (emailInput) {
        emailInput.value = email;
      }
    }

    if (!isValidNormalizedPhone(normalizedPhone)) {
      setFieldError(phoneInput, phoneError, "Введіть телефон у форматі +380XXXXXXXXX");
      hasError = true;
    } else {
      setFieldError(phoneInput, phoneError, "");
      if (phoneInput) {
        phoneInput.value = normalizedPhone;
      }
    }

    if (hasError) {
      return;
    }

    var eventId = getEventId();
    var attrib = collectAttrib();
    var payload = {
      site: SITE_KEY,
      offer_id: OFFER_ID,
      email: email,
      phone: normalizedPhone,
      event_id: eventId,
      value: PRICE_VALUE,
      currency: CURRENCY,
      utm_source: attrib.utm_source || "",
      utm_medium: attrib.utm_medium || "",
      utm_campaign: attrib.utm_campaign || "",
      utm_content: attrib.utm_content || "",
      utm_term: attrib.utm_term || "",
      fbclid: attrib.fbclid || "",
      cr: attrib.cr || "",
      lv: attrib.lv || "",
      referrer: attrib.referrer || "",
      page_url: attrib.page_url || "",
      user_agent: attrib.user_agent || ""
    };

    setLoading(true);

    fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(function(response) {
        return response.json().catch(function() {
          return { ok: false, code: "INVALID_JSON", message: "Некоректна відповідь сервера" };
        }).then(function(data) {
          return { status: response.status, data: data };
        });
      })
      .then(function(result) {
        var data = result.data || {};
        if (!data.paymentUrl) {
          throw data;
        }

        if (typeof fbq === "function") {
          fbq("track", "Lead", {
            value: PRICE_VALUE,
            currency: CURRENCY,
            content_name: CONTENT_NAME,
            lead_id: data.lead_id || "",
            offer_id: OFFER_ID
          }, { eventID: eventId });
        }

        window.location.href = data.paymentUrl;
      })
      .catch(function(err) {
        var message = (err && err.message) ? err.message : "Не вдалося перейти до оплати. Спробуйте ще раз.";
        setServerError(message);
      })
      .finally(function() {
        setLoading(false);
      });
  });
})();

$( ".openModal1" ).click(function(e) {
    e.preventDefault();
    $('#modal1').arcticmodal();
});
$( ".openModal2" ).click(function(e) {
    e.preventDefault();
    $('#modal2').arcticmodal();
});
$( ".openModal3" ).click(function(e) {
    e.preventDefault();
    $('#modal3').arcticmodal();
});
$( ".openModal4" ).click(function(e) {
    e.preventDefault();
    $('#modal4').arcticmodal();
});
$( ".openModal5" ).click(function(e) {
    e.preventDefault();
    $('#modal5').arcticmodal();
});
$( ".openModal6" ).click(function(e) {
    e.preventDefault();
    $('#modal6').arcticmodal();
});
$( ".openModal7" ).click(function(e) {
    e.preventDefault();
    $('#modal7').arcticmodal();
});
$( ".openModal8" ).click(function(e) {
    e.preventDefault();
    $('#modal8').arcticmodal();
});

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
    $(window).scroll(function(){
        if ( $(this).scrollTop() > 100 && $menu.hasClass("default") ){
            $menu.removeClass("default").addClass("fixed");
        } else if($(this).scrollTop() <= 100 && $menu.hasClass("fixed")) {
            $menu.removeClass("fixed").addClass("default");
        }
    });//scroll
});

$( ".showmore" ).click(function() {
    $(this).hide();
    $('.hidd').slideDown('slow');
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
