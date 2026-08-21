/**
 * Checkout binder for funnels without their own js/common.js.
 *
 * way21 and reset-day carry a full landing runtime (countdowns, per-CTA package
 * selection, scroll depth, deferred video) and bind checkout inside it. consult
 * and herbs are single-offer pages with none of that machinery, so they get this
 * instead of a copy of a 580-line file: one delegated click handler that turns
 * any `[data-cw-checkout]` element into a WayForPay redirect.
 *
 * Contract, read off the clicked element:
 *   data-cw-checkout      — presence marks the trigger (value unused)
 *   data-cw-product       — payable product code, must exist in PRODUCTS
 *   data-cw-price-value   — analytics value only; the CHARGED amount always
 *                           comes from the server (PRODUCTS[...].amount), so a
 *                           stale number here can never mischarge anyone
 *   data-cw-offer-id      — optional offer label carried into the order payload
 *
 * Attribution mirrors js/common.js: utm_* and fbclid from the URL, _fbp/_fbc
 * from cookies. /api/pay/start reads the same cookies server-side, so a missing
 * value here degrades to server-side resolution rather than losing the order.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var API_BASE = window.CW_API_BASE || window.location.origin;
  var PAY_ENDPOINT = API_BASE + "/api/pay/start";
  var CURRENCY = "UAH";
  var REDIRECT_RESET_MS = 5000;
  var isRedirecting = false;

  function readCookie(name) {
    try {
      var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : "";
    } catch (_) {
      return "";
    }
  }

  function collectAttrib() {
    var sp = new URLSearchParams(window.location.search);
    var out = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].forEach(function (key) {
      var value = sp.get(key);
      if (value) out[key] = value;
    });
    var fbp = readCookie("_fbp");
    var fbc = readCookie("_fbc");
    if (fbp) out.fbp = fbp;
    if (fbc) out.fbc = fbc;
    return out;
  }

  function makeEventId(prefix) {
    var rand = Math.random().toString(16).slice(2, 10);
    return prefix + "_" + Date.now().toString(36) + "_" + rand;
  }

  function parsePositiveNumber(value, fallback) {
    var num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  }

  function resolveSelection(trigger) {
    return {
      product: trigger.getAttribute("data-cw-product") || "",
      offerId: trigger.getAttribute("data-cw-offer-id") || "",
      value: parsePositiveNumber(trigger.getAttribute("data-cw-price-value"), 0),
      contentName: trigger.getAttribute("data-cw-content-name") || "",
    };
  }

  function buildPayUrl(selection, attrib, eventId) {
    var url = new URL(PAY_ENDPOINT, window.location.origin);
    url.searchParams.set("product", selection.product);
    url.searchParams.set("site", selection.product);
    if (selection.offerId) url.searchParams.set("offer_id", selection.offerId);
    if (selection.value > 0) url.searchParams.set("value", String(selection.value));
    url.searchParams.set("currency", CURRENCY);
    url.searchParams.set("event_id", eventId);

    Object.keys(attrib).forEach(function (key) {
      if (attrib[key]) url.searchParams.set(key, String(attrib[key]));
    });

    return url.toString();
  }

  function setLoading(loading) {
    document.querySelectorAll("[data-cw-checkout]").forEach(function (node) {
      if (node instanceof HTMLButtonElement) node.disabled = loading;
      node.classList.toggle("is-loading", loading);
    });
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-cw-checkout]");
    if (!trigger) return;

    event.preventDefault();
    if (isRedirecting) return;

    var selection = resolveSelection(trigger);
    // No product code means the markup is wrong, not that the buyer should be
    // sent to a default product — silently charging for something else is worse
    // than a dead button, which shows up immediately in QA.
    if (!selection.product) return;

    isRedirecting = true;
    setLoading(true);

    var attrib = collectAttrib();
    var eventId = makeEventId("checkout_" + selection.product);

    if (typeof fbq === "function") {
      var payload = { currency: CURRENCY };
      if (selection.value > 0) payload.value = selection.value;
      if (selection.contentName) payload.content_name = selection.contentName;
      if (selection.offerId) payload.offer_id = selection.offerId;
      Object.assign(payload, attrib);
      fbq("track", "InitiateCheckout", payload, { eventID: eventId });
    }

    window.location.assign(buildPayUrl(selection, attrib, eventId));

    // If the browser blocks or defers the navigation the page stays usable
    // instead of leaving every CTA permanently disabled.
    window.setTimeout(function () {
      isRedirecting = false;
      setLoading(false);
    }, REDIRECT_RESET_MS);
  });
})();
