(function () {
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
})();

