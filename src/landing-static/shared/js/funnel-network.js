(function() {
  var revealNodes = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealNodes.length > 0) {
    var revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    revealNodes.forEach(function(node, index) {
      node.style.transitionDelay = Math.min(index % 4, 3) * 60 + "ms";
      revealObserver.observe(node);
    });
  } else {
    revealNodes.forEach(function(node) {
      node.classList.add("is-visible");
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener("click", function(event) {
      var href = anchor.getAttribute("href");
      if (!href || href.length < 2) return;
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  var sticky = document.querySelector("[data-sticky-cta]");
  var stickyTargets = document.querySelectorAll("[data-observe-cta]");
  if (sticky && stickyTargets.length > 0 && "IntersectionObserver" in window) {
    var visible = new Set();
    var stickyObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          visible.add(entry.target);
        } else {
          visible.delete(entry.target);
        }
      });
      sticky.classList.toggle("is-hidden", visible.size > 0);
    }, { threshold: 0.01 });

    stickyTargets.forEach(function(target) {
      stickyObserver.observe(target);
    });
  }

  document.querySelectorAll("[data-faq-group]").forEach(function(group) {
    group.querySelectorAll("details").forEach(function(item) {
      item.addEventListener("toggle", function() {
        if (!item.open) return;
        group.querySelectorAll("details").forEach(function(other) {
          if (other !== item) {
            other.open = false;
          }
        });
      });
    });
  });

  function paramsFromLocation() {
    var search = new URLSearchParams(window.location.search);
    return {
      page_url: window.location.href,
      referrer: document.referrer || "",
      utm_source: search.get("utm_source") || "",
      utm_medium: search.get("utm_medium") || "",
      utm_campaign: search.get("utm_campaign") || "",
      utm_content: search.get("utm_content") || "",
      utm_term: search.get("utm_term") || "",
      fbclid: search.get("fbclid") || ""
    };
  }

  document.querySelectorAll("[data-cw-lead-form]").forEach(function(form) {
    form.addEventListener("submit", async function(event) {
      event.preventDefault();

      var submit = form.querySelector('button[type="submit"]');
      var status = form.querySelector("[data-form-status]");
      var payload = new FormData(form);

      if (submit instanceof HTMLButtonElement) {
        submit.disabled = true;
        submit.textContent = "Надсилаємо...";
      }

      if (status instanceof HTMLElement) {
        status.dataset.tone = "";
        status.textContent = "";
      }

      var body = {
        name: String(payload.get("name") || ""),
        phone: String(payload.get("phone") || ""),
        email: String(payload.get("email") || ""),
        interest: String(payload.get("interest") || ""),
        message: String(payload.get("message") || ""),
        product_code: form.getAttribute("data-product-code") || "consult",
        source: form.getAttribute("data-source") || "static_funnel_form",
        cta_place: form.getAttribute("data-cta-place") || "static_funnel_form",
        ...paramsFromLocation()
      };

      try {
        var response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          throw new Error("lead_failed");
        }

        if (typeof window.CW_trackLead === "function") {
          window.CW_trackLead({
            email: body.email,
            phone: body.phone,
            product: body.product_code
          });
        }

        form.reset();
        if (status instanceof HTMLElement) {
          status.dataset.tone = "success";
          status.textContent = "Запит зафіксовано. Ми зв'яжемось із вами.";
        }
      } catch (_) {
        if (status instanceof HTMLElement) {
          status.dataset.tone = "error";
          status.textContent = "Не вдалося надіслати форму. Спробуйте ще раз або напишіть у Telegram.";
        }
      } finally {
        if (submit instanceof HTMLButtonElement) {
          submit.disabled = false;
          submit.textContent = submit.getAttribute("data-default-label") || "Надіслати";
        }
      }
    });
  });
})();
