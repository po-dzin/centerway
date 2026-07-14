(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-testimonial-carousel]").forEach(function (root) {
    var track = root.querySelector("[data-carousel-track]");
    var previous = root.querySelector("[data-carousel-prev]");
    var next = root.querySelector("[data-carousel-next]");
    var dots = root.querySelector("[data-carousel-dots]");
    var slides = Array.prototype.slice.call(root.querySelectorAll("[data-carousel-item]"));
    if (!track || !previous || !next || !slides.length) return;

    if (!dots) return;
    slides.forEach(function (_, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "testimonial-carousel__dot";
      dot.setAttribute("aria-label", "Перейти до відгуку " + (index + 1));
      dot.addEventListener("click", function () { move(index); });
      dots.appendChild(dot);
    });
    var dotButtons = Array.prototype.slice.call(dots.querySelectorAll(".testimonial-carousel__dot"));
    var activeIndex = 0;
    function update() {
      var trackLeft = track.getBoundingClientRect().left;
      var nearestIndex = 0;
      var nearestDistance = Infinity;
      slides.forEach(function (slide, index) {
        var distance = Math.abs(slide.getBoundingClientRect().left - trackLeft);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      activeIndex = nearestIndex;
      previous.disabled = activeIndex === 0;
      next.disabled = activeIndex === slides.length - 1;
      dotButtons.forEach(function (dot, index) {
        var isActive = index === activeIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    }

    function move(index) {
      slides[index].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "start" });
    }
    previous.addEventListener("click", function () { move(Math.max(0, activeIndex - 1)); });
    next.addEventListener("click", function () { move(Math.min(slides.length - 1, activeIndex + 1)); });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", update);
    update();
  });
})();
