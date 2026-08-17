(function () {
  var nav = document.querySelector("[data-cw-network-nav]");
  if (!nav) return;
  if (nav.classList.contains("cwn--suspended")) return;

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

  // Tone: the bar inverts to light labels while it sits over a photo hero, and
  // returns to ink once the page canvas is behind it. This is the landing's
  // stand-in for the platform's backdrop sampling — the backdrop here is known
  // (the hero photograph), so the overlap is the whole signal. Runs for every
  // bar mode, including the anchored one that returns below.
  // Two backdrop-driven states, both measured against the bar's own bottom edge
  // in one frame:
  //
  //   photo hero  — the bar steps aside entirely. The first screen of a photo
  //                 hero is the offer's whole atmosphere, and a glass bar dense
  //                 enough to carry labels over an arbitrary photograph is, by
  //                 construction, a heavy one. It returns the moment the hero
  //                 has passed — no scroll-up gesture required, unlike the
  //                 floating mode below.
  //   dark section — the bar stays, but flips to the night tone (inverse ink),
  //                 the landing counterpart of the platform's tone sampling.
  //                 Sections opt in with data-cw-nav-dark.
  var photoHero = document.querySelector('[data-cw-hero="photo"] .hero');
  var darkSections = document.querySelectorAll("[data-cw-nav-dark]");
  if (photoHero || darkSections.length) {
    // The photo hero is a mobile treatment; above 880px the same section is the
    // light two-column card, where hiding the bar would be pointless.
    var photoHeroMq = window.matchMedia("(max-width: 880px)");
    var backdropFrame = null;
    var applyBackdrop = function () {
      backdropFrame = null;
      var barBottom = nav.getBoundingClientRect().bottom;

      if (photoHero) {
        var overHero = photoHeroMq.matches && photoHero.getBoundingClientRect().bottom > barBottom;
        nav.classList.toggle("cwn--hero-hidden", overHero);
        if (overHero) setOpen(false);
      }

      // A marked block only counts while it is actually the ground under the
      // bar — vertically AND horizontally. Some dark blocks are one column of a
      // grid (way21's self-format card): full width on mobile, half the row on
      // desktop, where the other half is light canvas. Requiring it to cover
      // most of the bar's own width keeps the tone from flipping over a
      // backdrop that is only half dark.
      var barBox = nav.getBoundingClientRect();
      var overDark = false;
      for (var i = 0; i < darkSections.length; i += 1) {
        var box = darkSections[i].getBoundingClientRect();
        if (box.top >= barBottom || box.bottom <= barBox.top) continue;
        var covered = Math.min(box.right, barBox.right) - Math.max(box.left, barBox.left);
        if (covered >= barBox.width * 0.6) {
          overDark = true;
          break;
        }
      }
      if (overDark) nav.setAttribute("data-cw-nav-tone", "dark");
      else nav.removeAttribute("data-cw-nav-tone");
    };
    window.addEventListener("scroll", function () {
      if (backdropFrame !== null) return;
      backdropFrame = window.requestAnimationFrame(applyBackdrop);
    }, { passive: true });
    window.addEventListener("resize", applyBackdrop, { passive: true });
    applyBackdrop();
  }

  // Anchored bars (way21 / reset-day) carry in-page section links, so they stay
  // visible from the first screen and skip the show/hide logic entirely. The
  // burger, focus and escape handling above still apply.
  if (nav.classList.contains("cwn--anchored")) return;

  // The header does not take space on the initial hero. As soon as the visitor
  // reverses upward — including within that hero — it returns as a fixed layer,
  // then hides again while reading down.
  var frame = null;
  var lastScrollY = window.scrollY;
  var directionThreshold = 8;
  function updateHeaderPosition() {
    frame = null;
    var currentScrollY = window.scrollY;
    var distance = currentScrollY - lastScrollY;

    if (currentScrollY <= 0) {
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
