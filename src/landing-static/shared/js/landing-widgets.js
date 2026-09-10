/* THE PAGE WIDGETS of way21, irem and reset-day: FAQ accordion, the sticky
   menu, the reviews carousel. Byte-identical across the three, so one file;
   short has its own variant (short/js/widgets.js) — its sticky menu hides
   whenever any suppressing button is on screen, where this one waits until the
   top button has scrolled past — and short-b has none (it uses <details> and
   enhance.js). Kept apart from funnel-common.js, which is commerce and
   tracking only, so a landing can take one without the other. */
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
