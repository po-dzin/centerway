(function () {
  var nav = document.querySelector("[data-cw-network-nav]");
  if (!nav) return;

  // Paid-traffic sessions get a slim header (brand only): the funnel invariant
  // is one decision per node, so cross-node exits stay hidden for ad clicks
  // and visible for organic/network visitors. The same first-screen rule still
  // applies: it only appears after the hero.
  var SLIM_KEY = "cw-nav-slim";
  try {
    var search = window.location.search;
    var isPaid = /[?&](fbclid|gclid|ttclid)=/.test(search) || /[?&]utm_medium=(cpc|paid|ppc)/.test(search);
    if (isPaid) sessionStorage.setItem(SLIM_KEY, "1");
    if (sessionStorage.getItem(SLIM_KEY) === "1") {
      nav.classList.add("cwn--slim");
    }
  } catch (_) {
    /* storage unavailable — keep full nav */
  }

  var toggle = nav.querySelector(".cwn__toggle");
  var menu = nav.querySelector(".cwn__menu");
  if (!toggle || !menu) return;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  menu.addEventListener("click", function (event) {
    if (event.target instanceof Element && event.target.closest("a")) {
      setOpen(false);
    }
  });

  document.addEventListener("click", function (event) {
    if (!nav.classList.contains("is-open")) return;
    if (event.target instanceof Node && !nav.contains(event.target)) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  var mq = window.matchMedia("(min-width: 760px)");
  function onChange(e) {
    if (e.matches) setOpen(false);
  }
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(onChange);
  }

  // Keep the first screen dedicated to the offer. Beyond the hero, the header
  // stays out of the way while reading downward and returns only on an upward
  // scroll. It remains fixed only for the time it is actually visible.
  var hero = document.querySelector(".hero");
  var frame = null;
  var lastScrollY = window.scrollY;
  var directionThreshold = 8;
  function updateHeaderPosition() {
    frame = null;
    var currentScrollY = window.scrollY;
    var heroExitY = hero
      ? Math.max(nav.offsetHeight + 32, hero.offsetHeight - nav.offsetHeight)
      : nav.offsetHeight + 32;
    var isPastHero = currentScrollY >= heroExitY;
    var distance = currentScrollY - lastScrollY;

    if (!isPastHero) {
      nav.classList.remove("cwn--floating");
      setOpen(false);
    } else if (distance <= -directionThreshold) {
      nav.classList.add("cwn--floating");
    } else if (distance >= directionThreshold) {
      nav.classList.remove("cwn--floating");
      setOpen(false);
    }

    lastScrollY = currentScrollY;
  }

  window.addEventListener("scroll", function () {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(updateHeaderPosition);
  }, { passive: true });

  updateHeaderPosition();
})();
