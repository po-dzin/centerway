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
    return "fb.1." + Math.floor(nowMs / 1000) + "." + fbclid;
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
