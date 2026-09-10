/* short's page widgets — its own sticky-menu rule and carousel step; the
   commerce and tracking half of the old common.js is /shared/js/funnel-common.js. */
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
  var suppressingCtas = document.querySelectorAll(
    "[data-cta-primary], [data-cta-final], [data-cta-suppress-sticky]"
  );
  if (!menu) return;

  function isSignificantlyVisible(element, threshold) {
    if (!element) return false;
    var inset = typeof threshold === "number" ? threshold : 0;
    var rect = element.getBoundingClientRect();
    return rect.bottom > inset && rect.top < window.innerHeight - inset;
  }

  function shouldShowMenu() {
    var stickyThreshold = 24;
    for (var i = 0; i < suppressingCtas.length; i += 1) {
      if (isSignificantlyVisible(suppressingCtas[i], stickyThreshold)) {
        return false;
      }
    }
    return true;
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
    var firstItem = track ? track.querySelector(".reviews-item") : null;
    if (!track || !prev || !next) return;

    var scrollAmount = firstItem ? firstItem.getBoundingClientRect().width : 320;
    prev.addEventListener("click", function() {
      track.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });
    next.addEventListener("click", function() {
      track.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  });
}

function initShortLanding() {
  initAccordion();
  initStickyMenu();
  initReviewsCarousel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initShortLanding, { once: true });
} else {
  initShortLanding();
}
