/**
 * Shared premium lead-form modal for the platform-author landings.
 *
 * Markup contract (per landing):
 *   <button type="button" data-lead-open>...</button>        // opens the modal
 *   <div class="lead-modal" data-lead-modal hidden> ...
 *     <form data-lead-form data-lead-product="way21-support"> // program → product_code
 *       <input name="name" required> <input name="phone"> <input name="email">
 *       <textarea name="message"></textarea>
 *       <button type="submit">...</button>
 *       <p data-lead-status hidden></p>
 *     </form>
 *   </div>
 *
 * The program identity (data-lead-product) is submitted to /api/leads as
 * product_code, so the DB row always records which program the lead is for.
 * Optional data-lead-open="<product>" on a trigger overrides the form product.
 */
(function () {
  if (window.__cwLeadFormInit) return;
  window.__cwLeadFormInit = true;

  var API_BASE = (window.CW_API_BASE || "").replace(/\/$/, "");

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : "";
  }

  function attribution() {
    var sp = new URLSearchParams(window.location.search);
    return {
      page_url: window.location.href,
      referrer: document.referrer || "",
      utm_source: sp.get("utm_source") || "",
      utm_medium: sp.get("utm_medium") || "",
      utm_campaign: sp.get("utm_campaign") || "",
      utm_content: sp.get("utm_content") || "",
      utm_term: sp.get("utm_term") || "",
      fbclid: sp.get("fbclid") || "",
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
    };
  }

  function init() {
    var modal = document.querySelector("[data-lead-modal]");
    if (!modal) return;
    var form = modal.querySelector("[data-lead-form]");
    var status = modal.querySelector("[data-lead-status]");
    if (!form) return;

    var lastFocus = null;

    function openModal(productOverride) {
      if (productOverride) form.setAttribute("data-lead-product", productOverride);
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      var firstField = form.querySelector("input, textarea");
      if (firstField) setTimeout(function () { firstField.focus(); }, 30);
    }

    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener("click", function (event) {
      var opener = event.target.closest("[data-lead-open]");
      if (opener) {
        event.preventDefault();
        openModal(opener.getAttribute("data-lead-open") || "");
        return;
      }
      if (event.target.closest("[data-lead-close]")) {
        event.preventDefault();
        closeModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    function setStatus(msg, kind) {
      if (!status) return;
      status.hidden = false;
      status.textContent = msg;
      status.setAttribute("data-lead-status-kind", kind || "");
    }

    var submitting = false;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (submitting) return;

      var name = (form.elements.name && form.elements.name.value || "").trim();
      var phone = (form.elements.phone && form.elements.phone.value || "").trim();
      var email = (form.elements.email && form.elements.email.value || "").trim();
      var message = (form.elements.message && form.elements.message.value || "").trim();

      if (!name) {
        setStatus("Вкажіть, будь ласка, ім'я.", "error");
        return;
      }
      if (!phone && !email) {
        setStatus("Залиште телефон або email для зв'язку.", "error");
        return;
      }

      submitting = true;
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      setStatus("Надсилаємо…", "pending");

      var attrib = attribution();
      var payload = Object.assign(
        {
          name: name,
          phone: phone,
          email: email,
          message: message,
          product: form.getAttribute("data-lead-product") || "consult",
          source: "landing_lead_form",
          cta_place: "premium_modal",
          interest: form.getAttribute("data-lead-product") || "",
          event_id: "lead_" + Date.now() + "_" + Math.random().toString(16).slice(2),
        },
        attrib
      );

      fetch(API_BASE + "/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok && data && data.ok !== false, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) throw new Error("lead_failed");
          if (typeof window.fbq === "function") {
            try { window.fbq("track", "Lead", {}, { eventID: payload.event_id }); } catch (e) {}
          }
          form.innerHTML =
            '<p class="lead-modal__done">Дякуємо! Заявку надіслано — ми зв\'яжемось з вами найближчим часом.</p>' +
            '<button type="button" class="lead-modal__submit" data-lead-close>Закрити</button>';
        })
        .catch(function () {
          submitting = false;
          if (submitBtn) submitBtn.disabled = false;
          setStatus("Не вдалося надіслати. Спробуйте ще раз або напишіть нам у Telegram.", "error");
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
