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
    /* The dots live on a ROW inside the strip, and the strip is a window.
       Fifteen testimonials were fifteen dots in a line — a ruler rather than a
       control. The window holds ten; past that the row slides underneath it and
       the active dot is kept in the middle. A landing with ten or fewer
       testimonials is unaffected: the row simply sits centred. */
    var dotRow = document.createElement("div");
    dotRow.className = "testimonial-carousel__dots-row";
    slides.forEach(function (_, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "testimonial-carousel__dot";
      dot.setAttribute("aria-label", "Перейти до відгуку " + (index + 1));
      dot.addEventListener("click", function () { move(index); });
      dotRow.appendChild(dot);
    });
    dots.appendChild(dotRow);
    var dotButtons = Array.prototype.slice.call(dots.querySelectorAll(".testimonial-carousel__dot"));

    /* Where the row rests. Centred while it fits; otherwise the active dot is
       held in the middle and the row is clamped at both ends so the strip never
       pulls away from its own edge. The dot ON the edge shrinks — that is the
       strip saying «there is more this way» in its own language — but never the
       lit one, which at either end of the row IS the dot on the edge. */
    function placeRow() {
      var first = dotButtons[0].getBoundingClientRect();
      var size = first.width;
      var stride = dotButtons.length > 1
        ? dotButtons[1].getBoundingClientRect().left - first.left
        : size;
      var rowWidth = size + stride * (dotButtons.length - 1);
      var windowWidth = dots.clientWidth;
      var x;
      if (rowWidth <= windowWidth) {
        x = (windowWidth - rowWidth) / 2;
      } else {
        x = windowWidth / 2 - (activeIndex * stride + size / 2);
        x = Math.max(windowWidth - rowWidth, Math.min(0, x));
      }
      dotRow.style.transform = "translateX(" + Math.round(x) + "px)";
      /* A dot fades only where the row actually continues: clamped hard against
         either end there is nothing further that way. */
      var overflowing = rowWidth > windowWidth + 1;
      var atStart = x >= -0.5;
      var atEnd = x <= windowWidth - rowWidth + 0.5;
      dotButtons.forEach(function (dot, index) {
        if (!overflowing) { dot.classList.remove("is-edge"); return; }
        var centre = x + index * stride + size / 2;
        dot.classList.toggle("is-edge", index !== activeIndex && (
          (!atStart && centre < stride) ||
          (!atEnd && centre > windowWidth - stride)
        ));
      });
    }
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
      placeRow();
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
