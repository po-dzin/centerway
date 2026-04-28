(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var pixelId = window.CW_PIXEL_ID || "885125430564169";
  var data = {};

  try {
    var stored = JSON.parse(localStorage.getItem("cw_user") || "{}");
    if (stored.em) data.em = stored.em;
    if (stored.ph) data.ph = stored.ph;
  } catch (_) {}

  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      if (n.callMethod) {
        n.callMethod.apply(n, arguments);
      } else {
        n.queue.push(arguments);
      }
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq("init", pixelId, data);
  window.fbq("track", "PageView");

  var ADS_TAG_ID = "AW-957636387";
  var ADS_CONVERSION_ID = "AW-957636387/THR-CKrbn54cEKO-0cgD";

  function getCurrentProduct() {
    var fromScript = (document.currentScript && document.currentScript.dataset && document.currentScript.dataset.cwProduct) || "";
    if (fromScript === "short" || fromScript === "irem") return fromScript;

    var fromHtml = (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.cwLanding) || "";
    if (fromHtml === "short" || fromHtml === "irem") return fromHtml;

    var fromMain = document.querySelector("[data-cw-landing]");
    var mainValue = fromMain && fromMain.getAttribute("data-cw-landing");
    if (mainValue === "short" || mainValue === "irem") return mainValue;

    return "";
  }

  function isThanksPage() {
    var page = (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.cwPage) || "";
    if (page === "thanks") return true;

    var pathname = (window.location && window.location.pathname ? window.location.pathname : "").toLowerCase();
    return pathname === "/thanks" || pathname === "/thanks.html" || /\/thanks(?:\/|$)/.test(pathname);
  }

  function parseNumber(raw) {
    if (!raw) return null;
    var normalized = String(raw).replace(",", ".");
    var value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function setupGoogleAds() {
    var product = getCurrentProduct();
    if (product !== "short" && product !== "irem") return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };

    window.gtag("js", new Date());
    window.gtag("config", ADS_TAG_ID);

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ADS_TAG_ID);
    var first = document.getElementsByTagName("script")[0];
    if (first && first.parentNode) {
      first.parentNode.insertBefore(script, first);
    } else {
      document.head.appendChild(script);
    }

    if (!isThanksPage()) return;

    var qs = new URLSearchParams(window.location.search);
    var orderRef = qs.get("order_ref") || qs.get("orderReference") || "";
    var rrn = qs.get("payment_id") || qs.get("rrn") || "";
    var amount = parseNumber(qs.get("amount") || "");
    var currency = (qs.get("currency") || "UAH").toUpperCase();

    var dedupeId = orderRef || rrn || "thanks";
    var firedKey = "cw_google_ads_conversion:" + dedupeId;

    try {
      if (sessionStorage.getItem(firedKey) === "1") return;
    } catch (_) {}

    var payload = {
      send_to: ADS_CONVERSION_ID,
      currency: currency,
    };

    if (amount !== null) payload.value = amount;
    if (orderRef || rrn) payload.transaction_id = orderRef || rrn;

    window.gtag("event", "conversion", payload);

    try {
      sessionStorage.setItem(firedKey, "1");
    } catch (_) {}
  }

  setupGoogleAds();
})();
