/**
 * THE QUESTION BEFORE PAYMENT: «Куди надіслати доступ?»
 *
 * Access is matched by email and a gateway may not return the payer's address,
 * so a landing asks for it BEFORE the buyer leaves (owner's choice B,
 * 2026-10-11): one field, no code. The address travels to /api/pay/start as
 * `?email=` and is bound to the order there. It is NOT verified here — a typo
 * sends the access to the wrong inbox — so the hint asks the buyer to check it
 * and the address is remembered for the next time.
 *
 *   window.CW_askEmail(onDone, onCancel)
 *
 * Copy is Ukrainian, as the landings are; the voice is not final.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var STORE_KEY = "cw_buyer_email";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function remembered() {
    try {
      return window.localStorage.getItem(STORE_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function remember(email) {
    try {
      window.localStorage.setItem(STORE_KEY, email);
    } catch (_) {}
  }

  var STYLE =
    ".cw-eg{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;" +
    "background:color-mix(in srgb,var(--cw-sem-method-ink,#203126) 62%,transparent)}" +
    ".cw-eg__card{width:min(420px,100%);box-sizing:border-box;padding:22px 20px;border-radius:var(--cw-radius-lg,18px);" +
    "background:var(--cw-sem-calm-surface,#fff8ef);color:var(--cw-sem-method-ink,#203126);" +
    "font-family:var(--cw-font-ui,system-ui,sans-serif);display:grid;gap:12px}" +
    ".cw-eg__title{margin:0;font-size:1.25rem;line-height:1.2;font-weight:700}" +
    ".cw-eg__hint{margin:0;font-size:.9rem;color:var(--cw-sem-muted-ink,#48544c)}" +
    ".cw-eg__input{width:100%;box-sizing:border-box;padding:12px 14px;font:inherit;font-size:1rem;border-radius:12px;" +
    "border:1px solid var(--cw-sem-guide-primary,#456b58);background:#fff;color:inherit}" +
    ".cw-eg__input:focus-visible,.cw-eg__go:focus-visible,.cw-eg__back:focus-visible{outline:3px solid var(--cw-sem-guide-primary,#456b58);outline-offset:2px}" +
    ".cw-eg__error{margin:0;min-height:1.2em;font-size:.85rem;color:var(--cw-sem-boundary,#b76045)}" +
    ".cw-eg__go{padding:13px 16px;font:inherit;font-weight:700;border-radius:14px;border:0;cursor:pointer;" +
    "background:var(--cw-sem-warmth,#e5ae65);color:var(--cw-sem-on-warmth,#203126)}" +
    ".cw-eg__back{padding:8px;font:inherit;font-size:.9rem;border:0;background:none;cursor:pointer;color:var(--cw-sem-muted-ink,#48544c)}";

  function ensureStyle() {
    if (document.getElementById("cw-eg-style")) return;
    var style = document.createElement("style");
    style.id = "cw-eg-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function ask(onDone, onCancel) {
    ensureStyle();
    var opener = document.activeElement;

    var overlay = document.createElement("div");
    overlay.className = "cw-eg";
    overlay.innerHTML =
      '<form class="cw-eg__card" role="dialog" aria-modal="true" aria-labelledby="cw-eg-title" novalidate>' +
      '<h2 class="cw-eg__title" id="cw-eg-title">Куди надіслати доступ?</h2>' +
      '<p class="cw-eg__hint" id="cw-eg-hint">Перевірте адресу: на неї прийде чек і вхід.</p>' +
      '<input class="cw-eg__input" id="cw-eg-email" type="email" name="email" autocomplete="email" ' +
      'inputmode="email" placeholder="anna@gmail.com" aria-describedby="cw-eg-hint cw-eg-error" required>' +
      '<p class="cw-eg__error" id="cw-eg-error" role="alert"></p>' +
      '<button class="cw-eg__go" type="submit">Перейти до оплати</button>' +
      '<button class="cw-eg__back" type="button">Назад</button>' +
      "</form>";

    var form = overlay.firstChild;
    var input = overlay.querySelector("#cw-eg-email");
    var error = overlay.querySelector("#cw-eg-error");
    input.value = remembered();

    function close() {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      if (opener && typeof opener.focus === "function") opener.focus();
    }

    function cancel() {
      close();
      if (typeof onCancel === "function") onCancel();
    }

    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = input.value.trim();
      if (!EMAIL_RE.test(email)) {
        error.textContent = "Введіть адресу у форматі anna@gmail.com";
        input.focus();
        return;
      }
      remember(email);
      close();
      onDone(email);
    });
    overlay.querySelector(".cw-eg__back").addEventListener("click", cancel);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) cancel();
    });
    document.addEventListener("keydown", onKey, true);

    document.body.appendChild(overlay);
    input.focus();
  }

  window.CW_askEmail = ask;
})();
